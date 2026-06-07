import type { Customer, Medicine } from "@pharmacy-os/types";
import { Button, Card, CardContent, CardHeader, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency } from "@pharmacy-os/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";

type Preset = "today" | "7d" | "30d" | "3m" | "1y" | "custom";

interface RevenuePoint {
  date: string;
  revenue: number;
  ordersCount: number;
}

interface InventoryAnalytics {
  topSellingSkus: { medicineId: string; sku: string | null; name: string | null; quantitySold: number; revenue: number }[];
  deadStock: Medicine[];
  expiryRiskValue: number;
  revenueByCategory: { category: string; revenue: number; quantity: number }[];
  profitByDate: { date: string; grossRevenue: number; netProfit: number }[];
}

interface CustomerAnalytics {
  newCustomers: number;
  returningCustomers: number;
  averageTransactionValue: number;
  topCustomers: { customer: Customer | null; phone: string; totalSpend: number }[];
}

interface Gstr1Report {
  month: number;
  year: number;
  rates: { gstRate: number; taxableValue: number; taxCollected: number; billsCount: number }[];
}

const colors = ["#00D4AA", "#0A1628", "#F59E0B", "#E11D48", "#2563EB", "#7C3AED"];

const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const rangeFor = (preset: Preset, customStart: string, customEnd: string) => {
  const end = new Date();
  const start = new Date();
  if (preset === "today") start.setHours(0, 0, 0, 0);
  if (preset === "7d") start.setDate(end.getDate() - 6);
  if (preset === "30d") start.setDate(end.getDate() - 29);
  if (preset === "3m") start.setDate(end.getDate() - 89);
  if (preset === "1y") start.setDate(end.getDate() - 364);
  if (preset === "custom") {
    return {
      startDate: customStart || dateOnly(start),
      endDate: customEnd || dateOnly(end)
    };
  }
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
};

const groupByFor = (startDate: string, endDate: string): "day" | "week" | "month" => {
  const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000));
  if (days > 150) return "month";
  if (days > 45) return "week";
  return "day";
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const gstrToCsv = (report: Gstr1Report): Blob => {
  const headers = ["GST Rate", "Taxable Value", "Tax Collected", "Bills Count"];
  const rows = report.rates.map((rate) => [String(rate.gstRate), String(rate.taxableValue), String(rate.taxCollected), String(rate.billsCount)]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
};

export const AnalyticsPage = () => {
  const [preset, setPreset] = useState<Preset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const range = useMemo(() => rangeFor(preset, customStart, customEnd), [customEnd, customStart, preset]);
  const groupBy = groupByFor(range.startDate, range.endDate);
  const params = { ...range, groupBy };

  const revenueQuery = useQuery({
    queryKey: ["analytics-revenue", params],
    queryFn: () => unwrap<RevenuePoint[]>(api.get("/analytics/revenue", { params })),
    placeholderData: []
  });

  const inventoryQuery = useQuery({
    queryKey: ["analytics-inventory", params],
    queryFn: () => unwrap<InventoryAnalytics>(api.get("/analytics/inventory", { params }))
  });

  const customerQuery = useQuery({
    queryKey: ["analytics-customers", params],
    queryFn: () => unwrap<CustomerAnalytics>(api.get("/analytics/customers", { params }))
  });

  const exportGstr = useMutation({
    mutationFn: async () => {
      const end = new Date(range.endDate);
      const report = await unwrap<Gstr1Report>(api.get("/analytics/reports/gstr1", { params: { month: end.getMonth() + 1, year: end.getFullYear() } }));
      downloadBlob(gstrToCsv(report), `gstr1-${report.year}-${String(report.month).padStart(2, "0")}.csv`);
    },
    onSuccess: () => toast.success("GSTR-1 exported"),
    onError: () => toast.error("GSTR-1 export failed")
  });

  const generateReport = useMutation({
    mutationFn: () => unwrap<{ jobId: string | null }>(api.post("/analytics/reports/export", { reportType: "analytics-summary", ...range })),
    onSuccess: (result) => toast.success(result.jobId ? `Report queued: ${result.jobId}` : "Report will be generated when the queue is available"),
    onError: () => toast.error("Report generation failed")
  });

  const revenue = revenueQuery.data ?? [];
  const inventory = inventoryQuery.data;
  const customer = customerQuery.data;
  const atvTrend = revenue.map((point) => ({
    date: point.date,
    averageTransactionValue: point.ordersCount > 0 ? Math.round(point.revenue / point.ordersCount) : 0
  }));
  const orderTrend = revenue.map((point) => ({ date: point.date, ordersCount: point.ordersCount }));
  const deadStockValue = (inventory?.deadStock ?? []).slice(0, 12).map((medicine) => ({
    name: medicine.name,
    valueAtMrp: medicine.stockQty * medicine.mrp
  }));
  const topCustomerSpend = (customer?.topCustomers ?? []).slice(0, 10).map((row, index) => ({
    name: row.customer?.name ?? `Walk-in ${index + 1}`,
    totalSpend: row.totalSpend
  }));
  const newReturning = [
    { name: "New", value: customer?.newCustomers ?? 0 },
    { name: "Returning", value: customer?.returningCustomers ?? 0 }
  ];

  return (
    <section>
      <PageHeader
        title="Analytics"
        actions={
          <>
            <Button variant="outline" onClick={() => exportGstr.mutate()} disabled={exportGstr.isPending}>
              <Download className="h-4 w-4" /> Export GSTR-1
            </Button>
            <Button onClick={() => generateReport.mutate()} disabled={generateReport.isPending}>
              <Download className="h-4 w-4" /> {generateReport.isPending ? "Generating..." : "Generate Report"}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          ["today", "Today"],
          ["7d", "7D"],
          ["30d", "30D"],
          ["3m", "3M"],
          ["1y", "1Y"],
          ["custom", "Custom"]
        ].map(([key, label]) => (
          <Button key={key} variant={preset === key ? "primary" : "outline"} size="sm" onClick={() => setPreset(key as Preset)}>
            {label}
          </Button>
        ))}
        {preset === "custom" ? (
          <>
            <input className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-950" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            <input className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-950" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
          </>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>Revenue trend</CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area dataKey="revenue" stroke="#00D4AA" fill="#00D4AA33" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Revenue by category</CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={inventory?.revenueByCategory ?? []} dataKey="revenue" nameKey="category" label>
                  {(inventory?.revenueByCategory ?? []).map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Gross vs Net profit</CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventory?.profitByDate ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="grossRevenue" fill="#0A1628" />
                <Bar dataKey="netProfit" fill="#00D4AA" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Average transaction value trend</CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={atvTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="averageTransactionValue" stroke="#2563EB" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Orders count trend</CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={orderTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="ordersCount" stroke="#7C3AED" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Top 20 selling SKUs</CardHeader>
          <CardContent className="h-[520px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventory?.topSellingSkus ?? []} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip formatter={(value, name) => (name === "revenue" ? formatCurrency(Number(value)) : value)} />
                <Bar dataKey="quantitySold" fill="#00D4AA" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Customer new vs returning</CardHeader>
          <CardContent className="h-[520px]">
            <ResponsiveContainer width="100%" height="60%">
              <PieChart>
                <Pie data={newReturning} dataKey="value" nameKey="name" label>
                  {newReturning.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="rounded-md bg-slate-50 p-4 text-sm dark:bg-slate-900">
              <p className="flex justify-between"><span>Average transaction value</span><span className="font-semibold">{formatCurrency(customer?.averageTransactionValue ?? 0)}</span></p>
              <p className="mt-2 flex justify-between"><span>Expiry risk value</span><span className="font-semibold">{formatCurrency(inventory?.expiryRiskValue ?? 0)}</span></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Dead stock value</CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deadStockValue} layout="vertical" margin={{ left: 96 }}>
                <XAxis type="number" tickFormatter={(value) => `Rs ${Math.round(Number(value) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={136} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="valueAtMrp" fill="#E11D48" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Top customer spend</CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomerSpend} layout="vertical" margin={{ left: 96 }}>
                <XAxis type="number" tickFormatter={(value) => `Rs ${Math.round(Number(value) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={136} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="totalSpend" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Dead stock</CardHeader>
          <CardContent>
            <Table>
              <thead><tr>{["Medicine", "SKU", "Stock", "MRP"].map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
              <tbody>
                {(inventory?.deadStock ?? []).slice(0, 12).map((medicine) => (
                  <tr key={medicine.id}>
                    <Td>{medicine.name}</Td>
                    <Td>{medicine.sku}</Td>
                    <Td>{medicine.stockQty}</Td>
                    <Td>{formatCurrency(medicine.mrp)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Top 10 customers by spend</CardHeader>
          <CardContent>
            <Table>
              <thead><tr>{["Customer", "Phone", "Spend"].map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
              <tbody>
                {(customer?.topCustomers ?? []).map((row, index) => (
                  <tr key={row.customer?.id ?? row.phone}>
                    <Td>
                      {row.customer ? <Link to={`/customers/${row.customer.id}`} className="font-semibold text-navy-950 hover:text-teal-600 dark:text-white">{index + 1}. {row.customer.name}</Link> : `Walk-in ${index + 1}`}
                    </Td>
                    <Td>{row.phone}</Td>
                    <Td>{formatCurrency(row.totalSpend)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
