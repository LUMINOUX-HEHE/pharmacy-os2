import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MedicineCategory, ScheduleType } from "@pharmacy-os/types";
import type { Medicine } from "@pharmacy-os/types";

import "../lib/i18n";
import { api } from "../lib/api";
import { calculateCart } from "../features/billing/cart-calculations";
import { BillingPage } from "../pages/app/billing-page";

vi.mock("../lib/offline-billing", () => ({
  cacheMedicinesForOffline: vi.fn().mockResolvedValue(undefined),
  findOfflineMedicineByBarcode: vi.fn().mockResolvedValue(undefined),
  queueOfflineBill: vi.fn().mockResolvedValue(undefined),
  searchOfflineMedicines: vi.fn().mockResolvedValue([]),
  useOfflineBillingSync: () => ({
    online: true,
    pendingCount: 0,
    isSyncing: false,
    syncTotal: 0,
    syncedCount: 0,
    failedCount: 0,
    refreshPendingCount: vi.fn().mockResolvedValue(undefined)
  })
}));

const medicine: Medicine = {
  id: "med-calpol",
  pharmacyId: "pharmacy-1",
  name: "Calpol 500",
  genericName: "Paracetamol",
  sku: "CAL-500",
  category: MedicineCategory.TABLET,
  manufacturer: "GSK",
  batchNo: "B001",
  expiryDate: "2028-12-31T00:00:00.000Z",
  mfgDate: "2026-01-01T00:00:00.000Z",
  mrp: 10000,
  purchasePrice: 6000,
  gstRate: 12,
  hsnCode: "3004",
  stockQty: 8,
  reorderLevel: 3,
  scheduleType: ScheduleType.GENERAL,
  barcodeId: "8901234500001",
  isOnline: true,
  onlinePrice: null,
  isActive: true
};

const renderBillingPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("BillingCart", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        success: true,
        data: [medicine],
        message: "Inventory loaded",
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 }
      }
    });
  });

  it("adds an item, changes quantity, removes it, and updates totals", async () => {
    const user = userEvent.setup();
    renderBillingPage();

    await user.click(await screen.findByRole("button", { name: /Calpol 500/i }));
    expect(screen.getByRole("button", { name: /Increase Calpol 500 quantity/i })).toBeEnabled();
    expect(screen.getAllByText("₹112.00")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /Increase Calpol 500 quantity/i }));
    expect(screen.getAllByText("₹224.00")).toHaveLength(2);

    const discountInput = screen.getByLabelText("Calpol 500 discount percent");
    await user.clear(discountInput);
    await user.type(discountInput, "10");
    await waitFor(() => expect(screen.getAllByText("₹201.60")).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: /Remove Calpol 500/i }));
    expect(screen.queryByRole("button", { name: /Remove Calpol 500/i })).not.toBeInTheDocument();
    expect(within(screen.getByText("Total").parentElement as HTMLElement).getByText("₹0.00")).toBeInTheDocument();
  });

  it("keeps pure cart totals aligned with bill arithmetic", () => {
    const totals = calculateCart([{ medicine, quantity: 2, discount: 10 }]);
    expect(totals.subtotal).toBe(20000);
    expect(totals.discount).toBe(2000);
    expect(totals.gstAmount).toBe(2160);
    expect(totals.totalAmount).toBe(20160);
  });
});
