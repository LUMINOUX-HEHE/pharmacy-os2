import type { Order } from "@pharmacy-os/types";
import { Button, Card, CardContent, CardHeader, Skeleton } from "@pharmacy-os/ui";
import { formatCurrency } from "@pharmacy-os/utils";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, IndianRupee, Package, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "../../components/page-header";
import { useAuthStore } from "../../features/auth/auth-store";
import { api, unwrap } from "../../lib/api";
import { createPharmacySocket } from "../../lib/socket";

interface RevenuePoint {
  date: string;
  revenue: number;
  ordersCount: number;
}

interface LowStockResponse {
  total: number;
  medicines: { id: string; name: string; stockQty: number; reorderLevel: number }[];
}

interface ExpiryResponse {
  total: number;
  totalMrpAtRisk: number;
  medicines: { id: string; name: string; expiryDate: string }[];
}

interface InventoryAnalytics {
  topSellingSkus: { medicineId: string; name: string | null; sku: string | null; quantitySold: number }[];
}

interface ActivityItem {
  id: string;
  label: string;
  createdAt: string;
}

const statIconColor = {
  teal: "text-teal-500",
  rose: "text-rose-500",
  amber: "text-amber-500"
} as const;

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export const DashboardPage = () => {
  const { t } = useTranslation();
  const pharmacy = useAuthStore((state) => state.pharmacy);
  const [liveActivity, setLiveActivity] = useState<ActivityItem[]>([]);

  const ranges = useMemo(
    () => ({
      todayStart: startOfToday().toISOString(),
      now: new Date().toISOString(),
      monthStart: daysAgo(30).toISOString()
    }),
    []
  );

  const todayRevenue = useQuery({
    queryKey: ["dashboard-stats", "revenue-today", ranges.todayStart, ranges.now],
    queryFn: () =>
      unwrap<RevenuePoint[]>(
        api.get("/analytics/revenue", { params: { startDate: ranges.todayStart, endDate: ranges.now, groupBy: "day" } })
      )
  });

  const ordersToday = useQuery({
    queryKey: ["orders-today"],
    queryFn: () => unwrap<Order[]>(api.get("/orders", { params: { date: "today" } }))
  });

  const lowStock = useQuery({
    queryKey: ["low-stock-count"],
    queryFn: () => unwrap<LowStockResponse>(api.get("/inventory/alerts/low-stock"))
  });

  const expiryAlerts = useQuery({
    queryKey: ["expiry-alerts", 30],
    queryFn: () => unwrap<ExpiryResponse>(api.get("/inventory/alerts/expiry", { params: { days: 30 } }))
  });

  const revenueTrend = useQuery({
    queryKey: ["dashboard-revenue-30d", ranges.monthStart, ranges.now],
    queryFn: () =>
      unwrap<RevenuePoint[]>(
        api.get("/analytics/revenue", { params: { startDate: ranges.monthStart, endDate: ranges.now, groupBy: "day" } })
      )
  });

  const inventoryAnalytics = useQuery({
    queryKey: ["dashboard-top-medicines", ranges.monthStart, ranges.now],
    queryFn: () =>
      unwrap<InventoryAnalytics>(api.get("/analytics/inventory", { params: { startDate: ranges.monthStart, endDate: ranges.now } }))
  });

  useEffect(() => {
    if (!pharmacy?.id) return;
    const socket = createPharmacySocket(pharmacy.id);
    socket.on("order:new", (payload: { orderId?: string; order?: Order }) => {
      setLiveActivity((items) => [
        {
          id: crypto.randomUUID(),
          label: `New online order ${payload.orderId?.slice(-6).toUpperCase() ?? payload.order?.id.slice(-6).toUpperCase() ?? ""}`,
          createdAt: new Date().toISOString()
        },
        ...items
      ].slice(0, 8));
    });
    socket.on("billing:created", (payload: { billNo?: string }) => {
      setLiveActivity((items) => [
        { id: crypto.randomUUID(), label: `Bill ${payload.billNo ?? ""} created`, createdAt: new Date().toISOString() },
        ...items
      ].slice(0, 8));
    });
    return () => {
      socket.disconnect();
    };
  }, [pharmacy?.id]);

  const revenueToday = todayRevenue.data?.reduce((sum, point) => sum + point.revenue, 0) ?? 0;
  const revenueChartData = revenueTrend.data ?? [];
  const topMedicines =
    inventoryAnalytics.data?.topSellingSkus.map((item) => ({
      name: item.name ?? item.sku ?? item.medicineId.slice(-6).toUpperCase(),
      quantity: item.quantitySold
    })) ?? [];

  const statCards = [
    [t("dashboard.revenueToday"), formatCurrency(revenueToday), IndianRupee, "teal", todayRevenue.isLoading],
    [t("dashboard.ordersToday"), ordersToday.data?.length ?? 0, ShoppingBag, "teal", ordersToday.isLoading],
    [t("dashboard.lowStock"), lowStock.data?.total ?? 0, Package, "rose", lowStock.isLoading],
    [t("dashboard.expiry"), expiryAlerts.data?.total ?? 0, AlertTriangle, "amber", expiryAlerts.isLoading]
  ] as const;

  return (
    <section>
      <PageHeader title={t("dashboard.title")} />
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(([label, value, Icon, tone, loading]) => (
          <Card key={String(label)}>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <Icon className={`h-5 w-5 ${statIconColor[tone]}`} />
              </div>
              <p className="mt-4 text-3xl font-bold">{loading ? <Skeleton className="h-8 w-24" /> : value}</p>
              <div className="mt-3 h-2 rounded-full bg-teal-100 dark:bg-slate-800" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>{t("dashboard.revenueTrend")}</CardHeader>
          <CardContent className="h-80">
            {revenueTrend.isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `Rs ${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="revenue" stroke="#00D4AA" fill="#00D4AA33" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>{t("dashboard.topMedicines")}</CardHeader>
          <CardContent className="h-80">
            {inventoryAnalytics.isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMedicines} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#0A1628" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>{t("dashboard.activity")}</CardHeader>
          <CardContent className="space-y-3">
            {liveActivity.length === 0 ? (
              <p className="text-sm text-slate-500">No live activity yet.</p>
            ) : (
              liveActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                  <Activity className="h-4 w-4 text-teal-500" />
                  <span className="text-sm">{item.label}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>Alerts</CardHeader>
          <CardContent className="space-y-3">
            {(lowStock.data?.medicines ?? []).slice(0, 3).map((medicine) => (
              <Link key={medicine.id} to="/inventory" className="block rounded-md bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                {medicine.name}: {medicine.stockQty} left
              </Link>
            ))}
            {(expiryAlerts.data?.medicines ?? []).slice(0, 3).map((medicine) => (
              <Link key={medicine.id} to="/inventory" className="block rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                {medicine.name} expires soon
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>{t("dashboard.quickActions")}</CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {[
            ["New bill", "/billing"],
            ["Add medicine", "/inventory"],
            ["Create storefront", "/storefront"],
            ["Export sales", "/analytics"]
          ].map(([label, href]) => (
            <Button key={href} variant="outline">
              <Link to={href}>{label}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </section>
  );
};
