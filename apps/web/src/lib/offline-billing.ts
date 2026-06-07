import type { Customer, Medicine, OfflineBillDraft } from "@pharmacy-os/types";
import Dexie, { type EntityTable } from "dexie";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "./api";

export interface PendingBill extends OfflineBillDraft {
  synced: boolean;
  syncError?: string | null;
}

export interface OfflineSyncProgress {
  online: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncTotal: number;
  syncedCount: number;
  failedCount: number;
  refreshPendingCount: () => Promise<void>;
}

export const offlineBillingDb = new Dexie("pharmacy-os-offline") as Dexie & {
  medicines: EntityTable<Medicine, "id">;
  customers: EntityTable<Customer, "id">;
  pendingBills: EntityTable<PendingBill, "idempotencyKey">;
};

offlineBillingDb.version(1).stores({
  medicines: "id, name, sku, barcodeId",
  customers: "id, name, phone",
  pendingBills: "idempotencyKey, createdAt, synced"
});

export const cacheMedicinesForOffline = async (medicines: Medicine[]): Promise<void> => {
  if (medicines.length === 0) return;
  await offlineBillingDb.medicines.bulkPut(medicines);
};

export const queueOfflineBill = async (bill: Omit<OfflineBillDraft, "createdAt"> & { createdAt?: string }): Promise<void> => {
  await offlineBillingDb.pendingBills.put({
    ...bill,
    createdAt: bill.createdAt ?? new Date().toISOString(),
    synced: false,
    syncError: null
  });
};

export const searchOfflineMedicines = async (query: string, limit = 12): Promise<Medicine[]> => {
  const normalized = query.trim().toLowerCase();
  const rows = await offlineBillingDb.medicines.toArray();
  return rows
    .filter((medicine) => {
      if (!normalized) return true;
      return (
        medicine.name.toLowerCase().includes(normalized) ||
        medicine.genericName.toLowerCase().includes(normalized) ||
        medicine.sku.toLowerCase().includes(normalized) ||
        medicine.manufacturer.toLowerCase().includes(normalized) ||
        Boolean(medicine.barcodeId?.toLowerCase().includes(normalized))
      );
    })
    .slice(0, limit);
};

export const findOfflineMedicineByBarcode = async (barcode: string): Promise<Medicine | undefined> => {
  const normalized = barcode.trim().toLowerCase();
  if (!normalized) return undefined;
  const rows = await offlineBillingDb.medicines.toArray();
  return rows.find(
    (medicine) =>
      medicine.barcodeId?.toLowerCase() === normalized ||
      medicine.sku.toLowerCase() === normalized
  );
};

export const syncPendingBills = async (onProgress?: (progress: { total: number; synced: number; failed: number }) => void): Promise<void> => {
  const pending = (await offlineBillingDb.pendingBills.filter((bill) => !bill.synced).toArray()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const total = pending.length;
  let synced = 0;
  let failed = 0;
  onProgress?.({ total, synced, failed });

  for (const bill of pending) {
    try {
      const { synced: _synced, syncError: _syncError, ...payload } = bill;
      await api.post("/billing/bills", payload);
      await offlineBillingDb.pendingBills.update(bill.idempotencyKey, { synced: true, syncError: null });
      synced += 1;
      onProgress?.({ total, synced, failed });
    } catch (error) {
      failed += 1;
      await offlineBillingDb.pendingBills.update(bill.idempotencyKey, {
        syncError: error instanceof Error ? error.message : "Sync failed"
      });
      onProgress?.({ total, synced, failed });
      break;
    }
  }
};

const browserOnline = (): boolean => (typeof navigator === "undefined" ? true : navigator.onLine);

export const useOfflineBillingSync = (): OfflineSyncProgress => {
  const [online, setOnline] = useState(browserOnline);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await offlineBillingDb.pendingBills.filter((bill) => !bill.synced).count());
  }, []);

  const sync = useCallback(async () => {
    const currentlyOnline = browserOnline();
    setOnline(currentlyOnline);
    await refreshPendingCount();
    if (!currentlyOnline) return;

    const count = await offlineBillingDb.pendingBills.filter((bill) => !bill.synced).count();
    if (count === 0) return;

    setIsSyncing(true);
    setSyncTotal(count);
    setSyncedCount(0);
    setFailedCount(0);
    toast.info(`Syncing ${count} bill${count === 1 ? "" : "s"}...`);

    await syncPendingBills(({ total, synced, failed }) => {
      setSyncTotal(total);
      setSyncedCount(synced);
      setFailedCount(failed);
    });

    await refreshPendingCount();
    setIsSyncing(false);

    const remaining = await offlineBillingDb.pendingBills.filter((bill) => !bill.synced).count();
    if (remaining === 0) {
      toast.success(`${count} offline bill${count === 1 ? "" : "s"} synced`);
    } else {
      toast.error(`${remaining} offline bill${remaining === 1 ? "" : "s"} still pending`);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    const startupSync = window.setTimeout(() => {
      void sync();
    }, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearTimeout(startupSync);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [sync]);

  return { online, pendingCount, isSyncing, syncTotal, syncedCount, failedCount, refreshPendingCount };
};
