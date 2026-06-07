import { BillStatus, PaymentMode } from "@pharmacy-os/types";
import type { ApiResponse, Bill } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency, formatDateTime } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, IndianRupee, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api } from "../../lib/api";

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const fetchBillPdf = async (bill: Pick<Bill, "id" | "billNo">): Promise<void> => {
  const response = await api.get<Blob>(`/billing/bills/${bill.id}/pdf`, { responseType: "blob" });
  downloadBlob(new Blob([response.data], { type: "application/pdf" }), `${bill.billNo}.pdf`);
};

const billsToCsv = (bills: Bill[]): Blob => {
  const headers = ["Bill No", "Patient", "Phone", "Date", "Payment Mode", "Status", "Subtotal", "GST", "Discount", "Total"];
  const rows = bills.map((bill) => [
    bill.billNo,
    bill.patientName ?? "Walk-in",
    bill.patientPhone ?? "",
    bill.createdAt,
    bill.paymentMode,
    bill.status,
    String(bill.subtotal),
    String(bill.gstAmount),
    String(bill.discount),
    String(bill.totalAmount)
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
};

const statusTone = (status: BillStatus): "teal" | "amber" | "rose" | "slate" => {
  if (status === BillStatus.PAID) return "teal";
  if (status === BillStatus.CREDIT || status === BillStatus.DRAFT) return "amber";
  if (status === BillStatus.VOID) return "rose";
  return "slate";
};

export const BillingHistoryPage = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const billsQuery = useQuery({
    queryKey: ["bills", search, status, paymentMode, from, to],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Bill[]>>("/billing/bills", {
        params: {
          search: search || undefined,
          status: status || undefined,
          paymentMode: paymentMode || undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 100
        }
      });
      return response.data.data;
    },
    placeholderData: []
  });

  const markPaid = useMutation({
    mutationFn: (bill: Bill) => api.put(`/billing/bills/${bill.id}/payment`, { status: BillStatus.PAID, paymentMode: bill.paymentMode }),
    onSuccess: async () => {
      toast.success("Bill marked paid");
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: () => toast.error("Could not mark bill paid")
  });

  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const total = useMemo(() => bills.reduce((sum, bill) => sum + bill.totalAmount, 0), [bills]);

  return (
    <section>
      <PageHeader
        title="Billing History"
        actions={
          <Button variant="outline" onClick={() => downloadBlob(billsToCsv(bills), "billing-history.csv")} disabled={bills.length === 0}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <Card>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
            <Input placeholder="Search bill, patient, phone" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All status</option>
              {Object.values(BillStatus).map((value) => <option key={value}>{value}</option>)}
            </select>
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
              <option value="">All payments</option>
              {Object.values(PaymentMode).map((value) => <option key={value}>{value}</option>)}
            </select>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 text-sm font-semibold text-navy-950 dark:bg-slate-900 dark:text-white">
              <IndianRupee className="h-4 w-4" /> {formatCurrency(total)}
            </div>
          </div>

          <div className="mt-5">
            <Table>
              <thead>
                <tr>
                  {["Bill No", "Patient", "Date", "Payment", "Total", "Status", "Actions"].map((header) => <Th key={header}>{header}</Th>)}
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <Td>{bill.billNo}</Td>
                    <Td>
                      <p className="font-semibold text-navy-950 dark:text-white">{bill.patientName ?? "Walk-in"}</p>
                      <p className="text-xs text-slate-500">{bill.patientPhone ?? ""}</p>
                    </Td>
                    <Td>{formatDateTime(bill.createdAt)}</Td>
                    <Td>{bill.paymentMode}</Td>
                    <Td>{formatCurrency(bill.totalAmount)}</Td>
                    <Td><Badge tone={statusTone(bill.status)}>{bill.status}</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => void fetchBillPdf(bill)}>
                          <Printer className="h-4 w-4" /> Re-print
                        </Button>
                        {bill.status === BillStatus.CREDIT || bill.status === BillStatus.DRAFT ? (
                          <Button size="sm" onClick={() => markPaid.mutate(bill)} disabled={markPaid.isPending}>
                            Mark paid
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
