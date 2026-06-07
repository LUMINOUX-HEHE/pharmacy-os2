import { zodResolver } from "@hookform/resolvers/zod";
import { MedicineCategory, ScheduleType } from "@pharmacy-os/types";
import type { ApiResponse, Medicine } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, EmptyState, Input, Modal, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency, formatDate } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { z } from "zod";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";
import { medicineFormSchema } from "./inventory-schema";

type MedicineFormInput = z.input<typeof medicineFormSchema>;
type MedicineForm = z.output<typeof medicineFormSchema>;

interface InventoryMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InventoryResponse {
  data: Medicine[];
  meta: InventoryMeta;
}

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; sku?: string; message: string }[];
}

interface ExpiryResponse {
  total: number;
  totalMrpAtRisk: number;
  medicines: Medicine[];
}

const defaultValues: MedicineFormInput = {
  name: "",
  genericName: "",
  sku: "",
  category: MedicineCategory.TABLET,
  manufacturer: "",
  batchNo: "",
  hsnCode: "3004",
  stockQty: 10,
  reorderLevel: 10,
  scheduleType: ScheduleType.GENERAL,
  mrp: 100,
  purchasePrice: 70,
  gstRate: 12,
  expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  mfgDate: new Date().toISOString().slice(0, 10),
  barcodeId: "",
  isOnline: true,
  onlinePrice: ""
};

const toFormValues = (medicine: Medicine): MedicineFormInput => ({
  name: medicine.name,
  genericName: medicine.genericName,
  sku: medicine.sku,
  category: medicine.category,
  manufacturer: medicine.manufacturer,
  batchNo: medicine.batchNo,
  hsnCode: medicine.hsnCode,
  stockQty: medicine.stockQty,
  reorderLevel: medicine.reorderLevel,
  scheduleType: medicine.scheduleType,
  mrp: medicine.mrp / 100,
  purchasePrice: medicine.purchasePrice / 100,
  gstRate: medicine.gstRate,
  expiryDate: medicine.expiryDate.slice(0, 10),
  mfgDate: medicine.mfgDate.slice(0, 10),
  barcodeId: medicine.barcodeId ?? "",
  isOnline: medicine.isOnline,
  onlinePrice: medicine.onlinePrice ? medicine.onlinePrice / 100 : ""
});

const toApiPayload = (values: MedicineForm) => ({
  ...values,
  sku: values.sku || undefined,
  expiryDate: new Date(values.expiryDate),
  mfgDate: new Date(values.mfgDate),
  mrp: Math.round(values.mrp * 100),
  purchasePrice: Math.round(values.purchasePrice * 100),
  onlinePrice: values.onlinePrice === "" || values.onlinePrice === undefined ? null : Math.round(Number(values.onlinePrice) * 100),
  barcodeId: values.barcodeId || null
});

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const InventoryPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [expiryDays, setExpiryDays] = useState<7 | 30 | 60>(30);

  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 25);
  const category = searchParams.get("category") ?? "";
  const manufacturer = searchParams.get("manufacturer") ?? "";
  const stockStatus = searchParams.get("stockStatus") ?? "";
  const expiryStatus = searchParams.get("expiryStatus") ?? "";
  const sort = searchParams.get("sort") ?? "name";

  const form = useForm<MedicineFormInput, unknown, MedicineForm>({ resolver: zodResolver(medicineFormSchema), defaultValues });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (search) next.set("search", search);
      else next.delete("search");
      next.set("page", "1");
      setSearchParams(next, { replace: true });
    }, 300);
    return () => {
      window.clearTimeout(handle);
    };
  }, [search, searchParams, setSearchParams]);

  const params = useMemo(
    () => ({
      page,
      limit,
      search: searchParams.get("search") ?? undefined,
      category: category || undefined,
      manufacturer: manufacturer || undefined,
      stockStatus: stockStatus || undefined,
      expiryStatus: expiryStatus || undefined,
      sort
    }),
    [category, expiryStatus, limit, manufacturer, page, searchParams, sort, stockStatus]
  );

  const inventory = useQuery({
    queryKey: ["inventory", params],
    queryFn: async (): Promise<InventoryResponse> => {
      const response = await api.get<ApiResponse<Medicine[]>>("/inventory", { params });
      return {
        data: response.data.data,
        meta: {
          page: response.data.meta?.page ?? page,
          limit: response.data.meta?.limit ?? limit,
          total: response.data.meta?.total ?? response.data.data.length,
          totalPages: response.data.meta?.totalPages ?? 1
        }
      };
    }
  });

  const expiryAlerts = useQuery({
    queryKey: ["inventory-expiry-alerts", expiryDays],
    queryFn: () => unwrap<ExpiryResponse>(api.get("/inventory/alerts/expiry", { params: { days: expiryDays } }))
  });

  const saveMedicine = useMutation({
    mutationFn: (values: MedicineForm) =>
      editing
        ? unwrap(api.put(`/inventory/${editing.id}`, toApiPayload(values)))
        : unwrap(api.post("/inventory", toApiPayload(values))),
    onSuccess: async () => {
      toast.success(editing ? "Medicine updated" : "Medicine added");
      setFormOpen(false);
      setEditing(null);
      form.reset(defaultValues);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });

  const deleteMedicine = useMutation({
    mutationFn: (medicine: Medicine) => unwrap(api.delete(`/inventory/${medicine.id}`)),
    onSuccess: async () => {
      toast.success("Medicine deleted");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });

  const bulkImport = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return unwrap<ImportSummary>(api.post("/inventory/bulk-import", formData, { headers: { "Content-Type": "multipart/form-data" } }));
    },
    onSuccess: async (summary) => {
      setImportSummary(summary);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", key === "page" ? value || "1" : "1");
    setSearchParams(next);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset(defaultValues);
    setFormOpen(true);
  };

  const openEdit = (medicine: Medicine) => {
    setEditing(medicine);
    form.reset(toFormValues(medicine));
    setFormOpen(true);
  };

  const exportCsv = async () => {
    const response = await api.get<Blob>("/inventory/export", { responseType: "blob" });
    downloadBlob(response.data, "inventory.csv");
  };

  const meta = inventory.data?.meta ?? { page, limit, total: 0, totalPages: 1 };
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.total, meta.page * meta.limit);

  return (
    <section>
      <PageHeader
        title={t("inventory.title")}
        actions={
          <>
            <label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) bulkImport.mutate(file);
                  event.target.value = "";
                }}
              />
              <Button type="button" variant="outline">
                <Upload className="h-4 w-4" /> CSV
              </Button>
            </label>
            <Button variant="outline" onClick={() => void exportCsv()}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("inventory.addMedicine")}
            </Button>
          </>
        }
      />
      <Card>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_160px_170px_170px_150px]">
            <Input placeholder={t("common.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={category} onChange={(event) => setParam("category", event.target.value)}>
              <option value="">Category</option>
              {Object.values(MedicineCategory).map((value) => <option key={value}>{value}</option>)}
            </select>
            <Input placeholder="Manufacturer" value={manufacturer} onChange={(event) => setParam("manufacturer", event.target.value)} />
            <select className="rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={stockStatus} onChange={(event) => setParam("stockStatus", event.target.value)}>
              <option value="">Stock Status</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
            <select className="rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={sort} onChange={(event) => setParam("sort", event.target.value)}>
              <option value="name">Name</option>
              <option value="stockQty">Stock</option>
              <option value="expiryDate">Expiry</option>
              <option value="mrp">MRP</option>
            </select>
          </div>
          {inventory.data?.data.length === 0 ? (
            <EmptyState title={t("common.emptyTitle")} description={t("common.emptyDescription")} />
          ) : (
            <Table>
              <thead>
                <tr>
                  {[t("inventory.medicineName"), t("inventory.sku"), t("inventory.category"), t("inventory.manufacturer"), t("inventory.batch"), t("inventory.expiry"), t("inventory.mrp"), t("inventory.stock"), t("common.status"), t("common.actions")].map((header) => (
                    <Th key={header}>{header}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(inventory.data?.data ?? []).map((medicine) => {
                  const nearExpiry = new Date(medicine.expiryDate).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000;
                  const outOfStock = medicine.stockQty === 0;
                  const lowStock = medicine.stockQty <= medicine.reorderLevel;
                  return (
                    <tr key={medicine.id} className={nearExpiry ? "bg-amber-50/60 dark:bg-amber-500/5" : undefined}>
                      <Td>
                        <p className="font-semibold">{medicine.name}</p>
                        <p className="text-xs text-slate-500">{medicine.genericName}</p>
                      </Td>
                      <Td>{medicine.sku}</Td>
                      <Td>{medicine.category}</Td>
                      <Td>{medicine.manufacturer}</Td>
                      <Td>{medicine.batchNo}</Td>
                      <Td>{formatDate(medicine.expiryDate)}</Td>
                      <Td>{formatCurrency(medicine.mrp)}</Td>
                      <Td>{medicine.stockQty}</Td>
                      <Td>
                        <Badge tone={outOfStock ? "rose" : lowStock ? "amber" : nearExpiry ? "amber" : "teal"}>
                          {outOfStock ? "Out" : lowStock ? "Low" : nearExpiry ? "Expiry" : "OK"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(medicine)} aria-label="Edit medicine"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(medicine)} aria-label="Delete medicine"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>Showing {start}-{end} of {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setParam("page", String(meta.page - 1))}>Back</Button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setParam("page", String(meta.page + 1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent>
          <div className="mb-4 flex gap-2">
            {[7, 30, 60].map((days) => (
              <Button key={days} variant={expiryDays === days ? "primary" : "outline"} size="sm" onClick={() => setExpiryDays(days as 7 | 30 | 60)}>
                {days} days
              </Button>
            ))}
          </div>
          <p className="mb-3 text-sm text-slate-500">MRP at risk: {formatCurrency(expiryAlerts.data?.totalMrpAtRisk ?? 0)}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {(expiryAlerts.data?.medicines ?? []).slice(0, 12).map((medicine) => (
              <div key={medicine.id} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
                <span className="font-semibold">{medicine.name}</span> expires {formatDate(medicine.expiryDate)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal open={formOpen} title={editing ? "Edit medicine" : t("inventory.addMedicine")} onClose={() => setFormOpen(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => saveMedicine.mutate(values))}>
          <Input placeholder={t("inventory.medicineName")} {...form.register("name")} />
          <Input placeholder="Generic name" {...form.register("genericName")} />
          <Input placeholder="SKU" {...form.register("sku")} />
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" {...form.register("category")}>
            {Object.values(MedicineCategory).map((value) => <option key={value}>{value}</option>)}
          </select>
          <Input placeholder={t("inventory.manufacturer")} {...form.register("manufacturer")} />
          <Input placeholder={t("inventory.batch")} {...form.register("batchNo")} />
          <Input type="date" {...form.register("mfgDate")} />
          <Input type="date" {...form.register("expiryDate")} />
          <Input type="number" step="0.01" placeholder="MRP (Rs)" {...form.register("mrp")} />
          <Input type="number" step="0.01" placeholder="Purchase price (Rs)" {...form.register("purchasePrice")} />
          <Input type="number" placeholder="GST %" {...form.register("gstRate")} />
          <Input placeholder="HSN code" {...form.register("hsnCode")} />
          <Input type="number" placeholder={t("inventory.stock")} {...form.register("stockQty")} />
          <Input type="number" placeholder={t("inventory.reorder")} {...form.register("reorderLevel")} />
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" {...form.register("scheduleType")}>
            {Object.values(ScheduleType).map((value) => <option key={value}>{value}</option>)}
          </select>
          <Input placeholder="Barcode" {...form.register("barcodeId")} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("isOnline")} /> Online
          </label>
          <Input type="number" step="0.01" placeholder="Online price (Rs)" {...form.register("onlinePrice")} />
          <Button type="submit" className="md:col-span-2" disabled={saveMedicine.isPending}>{t("common.save")}</Button>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Delete medicine" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Delete {deleteTarget?.name}? This will hide it from active inventory.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteTarget && deleteMedicine.mutate(deleteTarget)}>Delete</Button>
        </div>
      </Modal>

      <Modal open={Boolean(importSummary)} title="Bulk import results" onClose={() => setImportSummary(null)}>
        <p className="font-semibold">{importSummary?.inserted ?? 0} inserted, {importSummary?.skipped ?? 0} skipped</p>
        <div className="mt-4 max-h-64 space-y-2 overflow-auto">
          {(importSummary?.errors ?? []).map((error) => (
            <div key={`${error.row}-${error.sku ?? ""}`} className="rounded-md bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              Row {error.row}: {error.message}
            </div>
          ))}
        </div>
      </Modal>
    </section>
  );
};
