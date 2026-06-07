import { CreditLedgerType, ReminderFrequency } from "@pharmacy-os/types";
import type { Bill, CreditLedger, Customer, Medicine, Reminder } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input, Modal, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency, formatDateTime } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Image, Plus, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";

interface LedgerEntry extends CreditLedger {
  runningBalance: number;
}

interface ReminderWithMedicine extends Reminder {
  medicine?: Medicine;
}

interface CustomerDetail extends Customer {
  lastVisit: string | null;
  totalSpend: number;
  purchaseHistory: (Bill & { items?: { id: string; medicine?: Medicine; quantity: number; amount: number }[] })[];
  creditLedger: LedgerEntry[];
  upcomingReminders: ReminderWithMedicine[];
}

interface ProfileForm {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

interface LedgerForm {
  type: CreditLedgerType;
  amount: string;
  description: string;
}

interface ReminderForm {
  medicineId: string;
  frequency: ReminderFrequency;
  sendTime: string;
}

const rupeesToPaise = (value: string): number => Math.max(0, Math.round(Number(value || 0) * 100));

const nextSendAtFor = (sendTime: string): string => {
  const [hours = "9", minutes = "0"] = sendTime.split(":");
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
  next.setHours(Number(hours), Number(minutes), 0, 0);
  return next.toISOString();
};

export const CustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const profileForm = useForm<ProfileForm>();
  const ledgerForm = useForm<LedgerForm>({ defaultValues: { type: CreditLedgerType.DEBIT, amount: "", description: "" } });
  const reminderForm = useForm<ReminderForm>({ defaultValues: { frequency: ReminderFrequency.WEEKLY, sendTime: "09:00", medicineId: "" } });

  const customerQuery = useQuery({
    queryKey: ["customer", id],
    queryFn: () => unwrap<CustomerDetail>(api.get(`/customers/${id}`)),
    enabled: Boolean(id)
  });

  const medicinesQuery = useQuery({
    queryKey: ["customer-reminder-medicines"],
    queryFn: () => unwrap<Medicine[]>(api.get("/inventory", { params: { limit: 100, sort: "name" } })),
    placeholderData: []
  });

  useEffect(() => {
    if (customerQuery.data) {
      profileForm.reset({
        name: customerQuery.data.name,
        phone: customerQuery.data.phone,
        email: customerQuery.data.email ?? "",
        address: customerQuery.data.address ?? ""
      });
    }
  }, [customerQuery.data, profileForm]);

  const updateProfile = useMutation({
    mutationFn: (values: ProfileForm) => unwrap<Customer>(api.put(`/customers/${id}`, values)),
    onSuccess: async () => {
      toast.success("Customer updated");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["customer", id] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: () => toast.error("Customer could not be updated")
  });

  const addLedger = useMutation({
    mutationFn: (values: LedgerForm) =>
      unwrap<LedgerEntry>(
        api.post(`/customers/${id}/ledger`, {
          type: values.type,
          amount: rupeesToPaise(values.amount),
          description: values.description
        })
      ),
    onSuccess: async () => {
      toast.success("Ledger entry added");
      setLedgerOpen(false);
      ledgerForm.reset({ type: CreditLedgerType.DEBIT, amount: "", description: "" });
      await queryClient.invalidateQueries({ queryKey: ["customer", id] });
    },
    onError: () => toast.error("Ledger entry could not be added")
  });

  const sendPaymentLink = useMutation({
    mutationFn: () => unwrap<{ url: string }>(api.post(`/customers/${id}/payment-link`)),
    onSuccess: (link) => {
      toast.success("Payment link sent");
      window.open(link.url, "_blank", "noopener,noreferrer");
    },
    onError: () => toast.error("Payment link could not be sent")
  });

  const addReminder = useMutation({
    mutationFn: (values: ReminderForm) =>
      unwrap<Reminder>(
        api.post("/reminders", {
          customerId: id,
          medicineId: values.medicineId,
          frequency: values.frequency,
          nextSendAt: nextSendAtFor(values.sendTime),
          isActive: true
        })
      ),
    onSuccess: async () => {
      toast.success("Reminder added");
      setReminderOpen(false);
      reminderForm.reset({ frequency: ReminderFrequency.WEEKLY, sendTime: "09:00", medicineId: "" });
      await queryClient.invalidateQueries({ queryKey: ["customer", id] });
    },
    onError: () => toast.error("Reminder could not be added")
  });

  const customer = customerQuery.data;
  const prescriptionUrls = useMemo(
    () => Array.from(new Set((customer?.purchaseHistory ?? []).map((bill) => bill.prescriptionUrl).filter(Boolean))) as string[],
    [customer?.purchaseHistory]
  );

  if (!id) {
    navigate("/customers");
    return null;
  }

  return (
    <section>
      <PageHeader
        title={customer?.name ?? "Customer"}
        actions={
          <Button variant="outline" onClick={() => navigate("/customers")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-navy-950 dark:text-white">Profile</h2>
              <Button variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "Edit"}</Button>
            </div>
            {editing ? (
              <form className="space-y-3" onSubmit={profileForm.handleSubmit((values) => updateProfile.mutate(values))}>
                <Input placeholder="Name" {...profileForm.register("name", { required: true })} />
                <Input placeholder="Phone" {...profileForm.register("phone", { required: true })} />
                <Input placeholder="Email" {...profileForm.register("email")} />
                <Input placeholder="Address" {...profileForm.register("address")} />
                <Button type="submit" disabled={updateProfile.isPending}><Save className="h-4 w-4" /> Save</Button>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                <p><span className="text-slate-500">Phone:</span> <span className="font-semibold">{customer?.phone}</span></p>
                <p><span className="text-slate-500">Email:</span> <span className="font-semibold">{customer?.email ?? "Not set"}</span></p>
                <p><span className="text-slate-500">Address:</span> <span className="font-semibold">{customer?.address ?? "Not set"}</span></p>
                <p><span className="text-slate-500">Last visit:</span> <span className="font-semibold">{customer?.lastVisit ? formatDateTime(customer.lastVisit) : "No purchases"}</span></p>
                <p><span className="text-slate-500">Total spend:</span> <span className="font-semibold">{formatCurrency(customer?.totalSpend ?? 0)}</span></p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-navy-950 dark:text-white">Credit Ledger</h2>
                <p className="text-sm text-slate-500">Outstanding {formatCurrency(customer?.creditBalance ?? 0)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLedgerOpen(true)}><Plus className="h-4 w-4" /> Add entry</Button>
                <Button onClick={() => sendPaymentLink.mutate()} disabled={!customer?.creditBalance || sendPaymentLink.isPending}>
                  <CreditCard className="h-4 w-4" /> Send Payment Link
                </Button>
              </div>
            </div>
            <Table>
              <thead><tr>{["Date", "Type", "Description", "Amount", "Balance"].map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
              <tbody>
                {(customer?.creditLedger ?? []).map((entry) => (
                  <tr key={entry.id}>
                    <Td>{formatDateTime(entry.createdAt)}</Td>
                    <Td><Badge tone={entry.type === CreditLedgerType.DEBIT ? "amber" : "teal"}>{entry.type}</Badge></Td>
                    <Td>{entry.description}</Td>
                    <Td>{formatCurrency(entry.amount)}</Td>
                    <Td>{formatCurrency(entry.runningBalance)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-4 font-semibold text-navy-950 dark:text-white">Purchase History</h2>
            <div className="space-y-3">
              {(customer?.purchaseHistory ?? []).map((bill) => (
                <div key={bill.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <Link to="/billing/history" className="font-semibold text-navy-950 hover:text-teal-600 dark:text-white">{bill.billNo}</Link>
                    <span className="font-semibold">{formatCurrency(bill.totalAmount)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{formatDateTime(bill.createdAt)} · {bill.paymentMode}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(bill.items ?? []).slice(0, 4).map((item) => (
                      <Badge key={item.id}>{item.medicine?.name ?? "Medicine"} × {item.quantity}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-navy-950 dark:text-white">Reminders</h2>
              <Button variant="outline" onClick={() => setReminderOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <div className="space-y-3">
              {(customer?.upcomingReminders ?? []).map((reminder) => (
                <div key={reminder.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <div>
                    <p className="font-semibold text-navy-950 dark:text-white">{reminder.medicine?.name ?? "Medicine"}</p>
                    <p className="text-sm text-slate-500">{reminder.frequency} · next {formatDateTime(reminder.nextSendAt)}</p>
                  </div>
                  <Badge tone="teal">Active</Badge>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-navy-950 dark:text-white">Prescriptions</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {prescriptionUrls.map((url) => (
                  <button key={url} type="button" onClick={() => setLightboxUrl(url)} className="grid aspect-square place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                    <img src={url} alt="Prescription" className="h-full w-full object-cover" />
                  </button>
                ))}
                {prescriptionUrls.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900">
                    <Image className="h-4 w-4" /> No prescriptions
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal open={ledgerOpen} title="Add Credit Entry" onClose={() => setLedgerOpen(false)}>
        <form className="grid gap-4" onSubmit={ledgerForm.handleSubmit((values) => addLedger.mutate(values))}>
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950 dark:text-white" {...ledgerForm.register("type")}>
            {Object.values(CreditLedgerType).map((type) => <option key={type}>{type}</option>)}
          </select>
          <Input type="number" min={0.01} step={0.01} placeholder="Amount" {...ledgerForm.register("amount", { required: true })} />
          <Input placeholder="Description" {...ledgerForm.register("description", { required: true })} />
          <Button type="submit" disabled={addLedger.isPending}>Save</Button>
        </form>
      </Modal>

      <Modal open={reminderOpen} title="Add Reminder" onClose={() => setReminderOpen(false)}>
        <form className="grid gap-4" onSubmit={reminderForm.handleSubmit((values) => addReminder.mutate(values))}>
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950 dark:text-white" {...reminderForm.register("medicineId", { required: true })}>
            <option value="">Select medicine</option>
            {(medicinesQuery.data ?? []).map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}
          </select>
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950 dark:text-white" {...reminderForm.register("frequency")}>
            {Object.values(ReminderFrequency).map((frequency) => <option key={frequency}>{frequency}</option>)}
          </select>
          <Input type="time" {...reminderForm.register("sendTime")} />
          <Button type="submit" disabled={addReminder.isPending}><Send className="h-4 w-4" /> Save reminder</Button>
        </form>
      </Modal>

      <Modal open={Boolean(lightboxUrl)} title="Prescription" onClose={() => setLightboxUrl(null)}>
        {lightboxUrl ? <img src={lightboxUrl} alt="Prescription" className="max-h-[70vh] w-full object-contain" /> : null}
      </Modal>
    </section>
  );
};
