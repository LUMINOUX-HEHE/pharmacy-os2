import { PaymentMode } from "@pharmacy-os/types";
import type { Bill, Medicine } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, EmptyState, Input } from "@pharmacy-os/ui";
import { formatCurrency } from "@pharmacy-os/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Minus, Plus, Printer, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { calculateCart, type BillingCartItem } from "../../features/billing/cart-calculations";
import {
  cacheMedicinesForOffline,
  findOfflineMedicineByBarcode,
  queueOfflineBill,
  searchOfflineMedicines,
  useOfflineBillingSync
} from "../../lib/offline-billing";
import { api, unwrap } from "../../lib/api";

interface BillInfo {
  patientName: string;
  patientPhone: string;
  doctorName: string;
  prescriptionUrl: string;
  paymentMode: PaymentMode;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  devMode: boolean;
}

type SaveBillResult = (Bill & { offline?: false }) | { offline: true; idempotencyKey: string };

const fetchMedicines = async (params: Record<string, string | number | undefined>): Promise<Medicine[]> =>
  unwrap<Medicine[]>(api.get("/inventory", { params }));

const browserOnline = (): boolean => (typeof navigator === "undefined" ? true : navigator.onLine);

const downloadPdf = async (bill: Pick<Bill, "id" | "billNo">, openInNewTab: boolean): Promise<void> => {
  const response = await api.get<Blob>(`/billing/bills/${bill.id}/pdf`, { responseType: "blob" });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  if (openInNewTab) {
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = `${bill.billNo}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export const BillingPage = () => {
  const { t } = useTranslation();
  const { online, pendingCount, isSyncing, syncTotal, syncedCount, refreshPendingCount } = useOfflineBillingSync();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<BillingCartItem[]>([]);
  const [offlineMedicines, setOfflineMedicines] = useState<Medicine[]>([]);
  const scanRef = useRef({ value: "", lastAt: 0 });
  const form = useForm<BillInfo>({
    defaultValues: { paymentMode: PaymentMode.CASH, patientName: "", patientPhone: "", doctorName: "", prescriptionUrl: "" }
  });

  const paymentMode = form.watch("paymentMode");
  const totals = useMemo(() => calculateCart(cart), [cart]);

  const cacheQuery = useQuery({
    queryKey: ["billing-offline-cache"],
    queryFn: () => fetchMedicines({ limit: 100, sort: "name" }),
    enabled: online,
    staleTime: 5 * 60 * 1000
  });

  const medicineQuery = useQuery({
    queryKey: ["billing-medicines", search],
    queryFn: () => fetchMedicines({ search, limit: 12, sort: "name" }),
    enabled: online,
    placeholderData: []
  });

  const upiOrder = useQuery({
    queryKey: ["billing-upi-order", totals.totalAmount],
    queryFn: () =>
      unwrap<RazorpayOrder>(
        api.post("/billing/payments/razorpay-order", {
          amount: totals.totalAmount,
          receipt: `pos-upi-${Date.now()}`
        })
      ),
    enabled: online && paymentMode === PaymentMode.UPI && totals.totalAmount > 0,
    staleTime: 0
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (cacheQuery.data) {
      void cacheMedicinesForOffline(cacheQuery.data);
    }
  }, [cacheQuery.data]);

  useEffect(() => {
    if (online) return;
    void searchOfflineMedicines(search).then(setOfflineMedicines);
  }, [online, search]);

  const addToCart = useCallback((medicine: Medicine) => {
    if (medicine.stockQty <= 0) {
      toast.error(`${medicine.name} is out of stock`);
      return;
    }

    setCart((items) => {
      const existing = items.find((item) => item.medicine.id === medicine.id);
      if (existing) {
        if (existing.quantity >= medicine.stockQty) {
          toast.error(`Only ${medicine.stockQty} ${medicine.name} in stock`);
          return items;
        }
        return items.map((item) => (item.medicine.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...items, { medicine, quantity: 1, discount: 0 }];
    });
  }, []);

  const findBarcode = useCallback(
    async (barcode: string) => {
      const normalized = barcode.trim();
      if (!normalized) return;

      const medicine = online
        ? (await fetchMedicines({ search: normalized, limit: 10 })).find(
            (row) => row.barcodeId === normalized || row.sku.toLowerCase() === normalized.toLowerCase()
          )
        : await findOfflineMedicineByBarcode(normalized);

      if (!medicine) {
        toast.error(`No medicine found for barcode ${normalized}`);
        return;
      }
      addToCart(medicine);
    },
    [addToCart, online]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const editable = target
        ? ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable
        : false;
      const now = Date.now();
      const rapid = now - scanRef.current.lastAt < 80;
      if (editable && !rapid) return;

      if (event.key === "Enter") {
        const code = scanRef.current.value;
        scanRef.current = { value: "", lastAt: 0 };
        if (code.length >= 4) {
          event.preventDefault();
          void findBarcode(code);
        }
        return;
      }

      if (event.key.length === 1) {
        scanRef.current.value = rapid ? `${scanRef.current.value}${event.key}` : event.key;
        scanRef.current.lastAt = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [findBarcode]);

  const saveBill = useMutation({
    networkMode: "always",
    mutationFn: async (values: BillInfo): Promise<SaveBillResult> => {
      const idempotencyKey = crypto.randomUUID();
      const payload = {
        patientName: values.patientName || null,
        patientPhone: values.patientPhone || null,
        doctorName: values.doctorName || null,
        prescriptionUrl: values.prescriptionUrl || null,
        paymentMode: values.paymentMode,
        discount: 0,
        idempotencyKey,
        items: cart.map((item) => ({ medicineId: item.medicine.id, quantity: item.quantity, discount: item.discount }))
      };

      if (!online || !browserOnline()) {
        await queueOfflineBill(payload);
        await refreshPendingCount();
        return { offline: true, idempotencyKey };
      }

      return unwrap<Bill>(api.post("/billing/bills", payload));
    },
    onSuccess: (result) => {
      toast.success(result.offline ? "Bill saved offline" : "Bill saved");
      setCart([]);
      form.reset({ paymentMode: PaymentMode.CASH, patientName: "", patientPhone: "", doctorName: "", prescriptionUrl: "" });
      if (!result.offline) {
        void downloadPdf(result, true);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Bill could not be saved");
    }
  });

  const submitBill = () => saveBill.mutate(form.getValues());
  const visibleMedicines = online ? medicineQuery.data ?? [] : offlineMedicines;
  const qrValue = `upi://pay?pa=demo@upi&pn=Pharmacy%20OS&am=${(totals.totalAmount / 100).toFixed(2)}&cu=INR&tr=${
    upiOrder.data?.id ?? "pending"
  }`;

  return (
    <section>
      <PageHeader
        title={t("billing.title")}
        actions={
          <>
            {pendingCount > 0 ? <Badge tone="teal">{t("billing.pendingSync", { count: pendingCount })}</Badge> : null}
            <Button variant="outline">
              <Link to="/billing/history">History</Link>
            </Button>
          </>
        }
      />

      {!online ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Offline Mode
        </div>
      ) : null}

      {isSyncing ? (
        <div className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
          <div className="flex justify-between font-semibold">
            <span>Syncing {syncTotal} bills...</span>
            <span>{syncedCount}/{syncTotal}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/80 dark:bg-slate-900">
            <div className="h-2 rounded-full bg-teal-500" style={{ width: `${syncTotal ? (syncedCount / syncTotal) * 100 : 0}%` }} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-navy-950 dark:text-white">{t("billing.cart")}</h2>
              <Badge tone={online ? "teal" : "amber"}>{online ? "Online" : "Offline"}</Badge>
            </div>

            <Input
              className="mt-4"
              placeholder={t("billing.medicineSearch")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {visibleMedicines.slice(0, 8).map((medicine) => (
                <button
                  key={medicine.id}
                  type="button"
                  onClick={() => addToCart(medicine)}
                  className="rounded-md border border-slate-200 p-3 text-left transition hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10"
                  disabled={medicine.stockQty <= 0}
                >
                  <p className="font-semibold text-navy-950 dark:text-white">{medicine.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {medicine.sku} · {formatCurrency(medicine.mrp)} · {medicine.stockQty} left
                  </p>
                </button>
              ))}
            </div>

            {visibleMedicines.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No medicines found" description="Try another search term or sync inventory while online." />
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {totals.lines.map((item) => (
                <div
                  key={item.medicine.id}
                  className="grid gap-3 rounded-md bg-slate-50 p-3 dark:bg-slate-900 md:grid-cols-[1fr_auto_8rem_7rem_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-navy-950 dark:text-white">{item.medicine.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(item.medicine.mrp)} · GST {item.medicine.gstRate}%</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Decrease ${item.medicine.name} quantity`}
                      onClick={() =>
                        setCart((items) =>
                          items.map((cartItem) =>
                            cartItem.medicine.id === item.medicine.id ? { ...cartItem, quantity: Math.max(1, cartItem.quantity - 1) } : cartItem
                          )
                        )
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Increase ${item.medicine.name} quantity`}
                      onClick={() => addToCart(item.medicine)}
                      disabled={item.quantity >= item.medicine.stockQty}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={item.discount}
                    aria-label={`${item.medicine.name} discount percent`}
                    onChange={(event) => {
                      const discount = Math.min(100, Math.max(0, Number(event.target.value) || 0));
                      setCart((items) =>
                        items.map((cartItem) => (cartItem.medicine.id === item.medicine.id ? { ...cartItem, discount } : cartItem))
                      );
                    }}
                  />
                  <span className="font-semibold text-navy-950 dark:text-white">{formatCurrency(item.totalAmount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.medicine.name}`}
                    onClick={() => setCart((items) => items.filter((cartItem) => cartItem.medicine.id !== item.medicine.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-semibold text-navy-950 dark:text-white">{t("billing.patient")}</h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitBill();
              }}
            >
              <Input placeholder="Patient name" {...form.register("patientName")} />
              <Input placeholder="Phone" {...form.register("patientPhone")} />
              <Input placeholder="Doctor name" {...form.register("doctorName")} />
              <Input placeholder="Prescription URL" {...form.register("prescriptionUrl")} />
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-navy-950 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                {...form.register("paymentMode")}
              >
                {Object.values(PaymentMode).map((mode) => <option key={mode}>{mode}</option>)}
              </select>

              {paymentMode === PaymentMode.UPI ? (
                <div className="grid place-items-center rounded-md bg-slate-50 p-5 dark:bg-slate-900">
                  <QRCodeSVG value={qrValue} size={180} includeMargin />
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {upiOrder.isLoading ? "Creating Razorpay order..." : upiOrder.data?.id ?? "Razorpay order unavailable"}
                  </p>
                </div>
              ) : null}

              <div className="rounded-md bg-navy-950 p-5 text-white dark:bg-slate-900">
                <p className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></p>
                <p className="mt-2 flex justify-between text-sm"><span>GST</span><span>{formatCurrency(totals.gstAmount)}</span></p>
                {Object.entries(totals.gstBreakup).map(([rate, amount]) => (
                  <p key={rate} className="mt-1 flex justify-between text-xs text-slate-300"><span>GST {rate}%</span><span>{formatCurrency(amount)}</span></p>
                ))}
                <p className="mt-2 flex justify-between text-sm"><span>Discount</span><span>{formatCurrency(totals.discount)}</span></p>
                <p className="mt-4 flex justify-between text-xl font-bold"><span>{t("common.total")}</span><span>{formatCurrency(totals.totalAmount)}</span></p>
              </div>

              <Button type="button" className="w-full" onClick={submitBill} disabled={cart.length === 0 || saveBill.isPending}>
                <Printer className="h-4 w-4" /> {t("billing.saveBill")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
