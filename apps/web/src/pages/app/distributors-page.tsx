import { MedicineCategory, PurchaseOrderStatus } from "@pharmacy-os/types";
import type { Distributor, Medicine, PurchaseOrder } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input, Modal, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, PackageCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";

interface DistributorForm {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin?: string | null;
  categories: MedicineCategory[];
}

interface PoDraftItem {
  medicine: Medicine;
  quantity: number;
}

interface LowStockResponse {
  medicines: (Medicine & { reorderSuggestionQty: number })[];
}

const statusTone = (status: PurchaseOrderStatus): "teal" | "amber" | "rose" | "slate" => {
  if (status === PurchaseOrderStatus.RECEIVED) return "teal";
  if (status === PurchaseOrderStatus.SENT) return "amber";
  if (status === PurchaseOrderStatus.CANCELLED) return "rose";
  return "slate";
};

export const DistributorsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [distributorOpen, setDistributorOpen] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [poDistributorId, setPoDistributorId] = useState("");
  const [poItems, setPoItems] = useState<PoDraftItem[]>([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [sendTarget, setSendTarget] = useState<PurchaseOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const form = useForm<DistributorForm>({
    defaultValues: { name: "", contactPerson: "", phone: "", email: "", gstin: "", categories: [MedicineCategory.TABLET] }
  });

  const distributorsQuery = useQuery({
    queryKey: ["distributors"],
    queryFn: () => unwrap<Distributor[]>(api.get("/distributors")),
    placeholderData: []
  });
  const poQuery = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => unwrap<PurchaseOrder[]>(api.get("/purchase-orders")),
    placeholderData: []
  });
  const inventoryQuery = useQuery({
    queryKey: ["po-inventory"],
    queryFn: () => unwrap<Medicine[]>(api.get("/inventory", { params: { limit: 100, sort: "name" } })),
    placeholderData: []
  });
  const lowStockQuery = useQuery({
    queryKey: ["low-stock-for-po"],
    queryFn: () => unwrap<LowStockResponse>(api.get("/inventory/alerts/low-stock"))
  });

  useEffect(() => {
    if (editingDistributor) {
      form.reset({
        name: editingDistributor.name,
        contactPerson: editingDistributor.contactPerson,
        phone: editingDistributor.phone,
        email: editingDistributor.email,
        gstin: editingDistributor.gstin ?? "",
        categories: editingDistributor.categories
      });
    } else {
      form.reset({ name: "", contactPerson: "", phone: "", email: "", gstin: "", categories: [MedicineCategory.TABLET] });
    }
  }, [editingDistributor, form]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["distributors"] }),
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["po-inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["low-stock-for-po"] })
    ]);
  };

  const saveDistributor = useMutation({
    mutationFn: (values: DistributorForm) => {
      const payload = { ...values, gstin: values.gstin || null };
      return editingDistributor ? unwrap(api.put(`/distributors/${editingDistributor.id}`, payload)) : unwrap(api.post("/distributors", payload));
    },
    onSuccess: async () => {
      toast.success(editingDistributor ? "Distributor updated" : "Distributor added");
      setDistributorOpen(false);
      setEditingDistributor(null);
      await invalidate();
    },
    onError: () => toast.error("Distributor could not be saved")
  });

  const deleteDistributor = useMutation({
    mutationFn: (id: string) => unwrap(api.delete(`/distributors/${id}`)),
    onSuccess: async () => {
      toast.success("Distributor deleted");
      setDeleteTarget(null);
      await invalidate();
    },
    onError: () => toast.error("Distributor could not be deleted")
  });

  const createPo = useMutation({
    mutationFn: () =>
      unwrap<PurchaseOrder>(
        api.post("/purchase-orders", {
          distributorId: poDistributorId,
          notes: "Created from Pharmacy OS",
          items: poItems.map((item) => ({
            medicineId: item.medicine.id,
            quantity: item.quantity,
            purchasePrice: item.medicine.purchasePrice
          }))
        })
      ),
    onSuccess: async () => {
      toast.success("Purchase order draft saved");
      setPoOpen(false);
      setPoItems([]);
      setPoDistributorId("");
      await invalidate();
    },
    onError: () => toast.error("Purchase order could not be created")
  });

  const sendPo = useMutation({
    mutationFn: (id: string) => unwrap<PurchaseOrder>(api.put(`/purchase-orders/${id}/send`)),
    onSuccess: async () => {
      toast.success("Purchase order sent");
      setSendTarget(null);
      await invalidate();
    },
    onError: () => toast.error("Purchase order could not be sent")
  });

  const receivePo = useMutation({
    mutationFn: (id: string) => unwrap<PurchaseOrder>(api.post(`/purchase-orders/${id}/receive`)),
    onSuccess: async () => {
      toast.success("Stock updated from purchase order");
      setReceiveTarget(null);
      await invalidate();
    },
    onError: () => toast.error("Purchase order could not be received")
  });

  const distributors = distributorsQuery.data ?? [];
  const purchaseOrders = poQuery.data ?? [];
  const filteredMedicines = (inventoryQuery.data ?? [])
    .filter((medicine) => (medicineSearch ? medicine.name.toLowerCase().includes(medicineSearch.toLowerCase()) || medicine.sku.toLowerCase().includes(medicineSearch.toLowerCase()) : true))
    .slice(0, 10);
  const poTotal = useMemo(() => poItems.reduce((sum, item) => sum + item.medicine.purchasePrice * item.quantity, 0), [poItems]);

  const addMedicine = (medicine: Medicine, quantity = 1) => {
    setPoItems((items) => {
      const existing = items.find((item) => item.medicine.id === medicine.id);
      if (existing) {
        return items.map((item) => (item.medicine.id === medicine.id ? { ...item, quantity: item.quantity + quantity } : item));
      }
      return [...items, { medicine, quantity }];
    });
  };

  const createFromLowStock = () => {
    if (distributors.length === 0) {
      toast.error("Add a distributor first");
      return;
    }
    const lowStock = lowStockQuery.data?.medicines ?? [];
    if (lowStock.length === 0) {
      toast.info("No low-stock medicines need reorder");
      return;
    }
    setPoDistributorId(distributors[0]?.id ?? "");
    setPoItems(lowStock.map((medicine) => ({ medicine, quantity: medicine.reorderSuggestionQty })));
    setPoOpen(true);
  };

  return (
    <section>
      <PageHeader
        title={t("modules.distributors")}
        actions={
          <>
            <Button variant="outline" onClick={createFromLowStock}>Create from low stock</Button>
            <Button onClick={() => { setEditingDistributor(null); setDistributorOpen(true); }}><Plus className="h-4 w-4" /> {t("common.add")}</Button>
            <Button onClick={() => setPoOpen(true)}><PackageCheck className="h-4 w-4" /> Create PO</Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardContent>
            <h2 className="mb-4 font-semibold text-navy-950 dark:text-white">Distributor List</h2>
            <div className="space-y-3">
              {distributors.map((distributor) => (
                <div key={distributor.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy-950 dark:text-white">{distributor.name}</p>
                      <p className="text-sm text-slate-500">{distributor.contactPerson} · {distributor.phone}</p>
                      <p className="text-sm text-slate-500">{distributor.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingDistributor(distributor); setDistributorOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(distributor)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-4 font-semibold text-navy-950 dark:text-white">Purchase Orders</h2>
            <Table>
              <thead><tr>{["ID", "Distributor", "Items", "Total", "Status", t("common.actions")].map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <Td>{po.id.slice(-6).toUpperCase()}</Td>
                    <Td>{po.distributor?.name}</Td>
                    <Td>{po.items?.length ?? 0}</Td>
                    <Td>{formatCurrency(po.totalAmount)}</Td>
                    <Td><Badge tone={statusTone(po.status)}>{po.status}</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {po.status === PurchaseOrderStatus.DRAFT ? (
                          <Button variant="outline" size="sm" onClick={() => setSendTarget(po)}><Mail className="h-4 w-4" /> Send</Button>
                        ) : null}
                        {po.status === PurchaseOrderStatus.SENT ? (
                          <Button size="sm" onClick={() => setReceiveTarget(po)}><PackageCheck className="h-4 w-4" /> Receive</Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Modal open={distributorOpen} title={editingDistributor ? "Edit Distributor" : "Add Distributor"} onClose={() => { setDistributorOpen(false); setEditingDistributor(null); }}>
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => saveDistributor.mutate(values))}>
          <Input placeholder="Name" {...form.register("name", { required: true })} />
          <Input placeholder="Contact person" {...form.register("contactPerson", { required: true })} />
          <Input placeholder="Phone" {...form.register("phone", { required: true })} />
          <Input placeholder="Email" {...form.register("email", { required: true })} />
          <Input placeholder="GSTIN" {...form.register("gstin")} />
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(MedicineCategory).map((category) => (
              <label key={category} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={category} {...form.register("categories", { required: true })} />
                {category}
              </label>
            ))}
          </div>
          <Button type="submit" disabled={saveDistributor.isPending}>{t("common.save")}</Button>
        </form>
      </Modal>

      <Modal open={poOpen} title="Create Purchase Order" onClose={() => setPoOpen(false)}>
        <div className="grid gap-4">
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950 dark:text-white" value={poDistributorId} onChange={(event) => setPoDistributorId(event.target.value)}>
            <option value="">Select distributor</option>
            {distributors.map((distributor) => <option key={distributor.id} value={distributor.id}>{distributor.name}</option>)}
          </select>
          <Input placeholder="Search inventory" value={medicineSearch} onChange={(event) => setMedicineSearch(event.target.value)} />
          <div className="grid max-h-52 gap-2 overflow-auto">
            {filteredMedicines.map((medicine) => (
              <button key={medicine.id} type="button" onClick={() => addMedicine(medicine)} className="flex items-center justify-between rounded-md border border-slate-200 p-2 text-left dark:border-slate-800">
                <span><span className="font-semibold">{medicine.name}</span> <span className="text-sm text-slate-500">{medicine.sku}</span></span>
                <span>{formatCurrency(medicine.purchasePrice)}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {poItems.map((item) => (
              <div key={item.medicine.id} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2 rounded-md bg-slate-50 p-2 dark:bg-slate-900">
                <span className="font-semibold">{item.medicine.name}</span>
                <Input type="number" min={1} value={item.quantity} onChange={(event) => setPoItems((items) => items.map((row) => row.medicine.id === item.medicine.id ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row))} />
                <Button variant="ghost" size="icon" onClick={() => setPoItems((items) => items.filter((row) => row.medicine.id !== item.medicine.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-md bg-navy-950 p-3 font-semibold text-white">
            <span>Total</span><span>{formatCurrency(poTotal)}</span>
          </div>
          <Button onClick={() => createPo.mutate()} disabled={!poDistributorId || poItems.length === 0 || createPo.isPending}>Save as DRAFT</Button>
        </div>
      </Modal>

      <Modal open={Boolean(sendTarget)} title="Send Purchase Order" onClose={() => setSendTarget(null)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Email preview to {sendTarget?.distributor?.email}</p>
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900">
          <p className="font-semibold">PO #{sendTarget?.id.slice(-6).toUpperCase()}</p>
          {(sendTarget?.items ?? []).map((item) => <p key={item.id}>{item.medicine?.name} × {item.quantity}</p>)}
          <p className="mt-2 font-semibold">Total {formatCurrency(sendTarget?.totalAmount ?? 0)}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setSendTarget(null)}>Cancel</Button>
          <Button onClick={() => sendTarget && sendPo.mutate(sendTarget.id)} disabled={sendPo.isPending}>Send PO</Button>
        </div>
      </Modal>

      <Modal open={Boolean(receiveTarget)} title="Receive Purchase Order" onClose={() => setReceiveTarget(null)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Receiving this PO will add stock quantities below.</p>
        <div className="mt-3 space-y-2">
          {(receiveTarget?.items ?? []).map((item) => (
            <div key={item.id} className="flex justify-between rounded-md bg-slate-50 p-2 text-sm dark:bg-slate-900">
              <span>{item.medicine?.name}</span><span>+{item.quantity}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setReceiveTarget(null)}>Cancel</Button>
          <Button onClick={() => receiveTarget && receivePo.mutate(receiveTarget.id)} disabled={receivePo.isPending}>Confirm stock update</Button>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Delete Distributor" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Delete {deleteTarget?.name}? Existing purchase orders remain for audit history.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteTarget && deleteDistributor.mutate(deleteTarget.id)} disabled={deleteDistributor.isPending}>Delete</Button>
        </div>
      </Modal>
    </section>
  );
};
