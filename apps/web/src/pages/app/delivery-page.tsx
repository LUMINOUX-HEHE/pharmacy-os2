import type { DeliveryDriver } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input, Modal, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency, formatDateTime } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { useAuthStore } from "../../features/auth/auth-store";
import { api, unwrap } from "../../lib/api";

interface LiveDelivery {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  customerCoords: { lat: number; lng: number };
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  assignedAt: string | null;
  itemsCount: number;
  total: number;
}

interface DeliveryHistoryRow {
  id: string;
  assignedAt: string;
  deliveredAt: string | null;
  driver?: DeliveryDriver;
  order?: {
    id: string;
    total: number;
    customer?: { name: string; phone: string; address: string | null };
  };
}

interface DriverForm {
  name: string;
  phone: string;
  vehicle: string;
  isActive: boolean;
}

const cityCoords: Record<string, [number, number]> = {
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  pune: [18.5204, 73.8567]
};

const pinIcon = (kind: "driver" | "order", active = true) =>
  L.divIcon({
    className: "",
    html:
      kind === "driver"
        ? `<div style="width:28px;height:28px;border-radius:999px;background:${active ? "#0f766e" : "#64748b"};color:white;display:grid;place-items:center;border:2px solid white;box-shadow:0 8px 18px rgba(15,23,42,.25);font-weight:700">D</div>`
        : `<div style="width:30px;height:30px;border-radius:8px;background:#f59e0b;color:#111827;display:grid;place-items:center;border:2px solid white;box-shadow:0 8px 18px rgba(15,23,42,.25);font-weight:800">P</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });

const offsetPosition = ([lat, lng]: [number, number], index: number): [number, number] => [
  lat + (index % 4) * 0.006,
  lng - Math.floor(index / 4) * 0.006
];

const deliveryMinutes = (row: DeliveryHistoryRow): number | null => {
  if (!row.deliveredAt) return null;
  return Math.max(0, Math.round((new Date(row.deliveredAt).getTime() - new Date(row.assignedAt).getTime()) / 60000));
};

export const DeliveryPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pharmacy = useAuthStore((state) => state.pharmacy);
  const [driverOpen, setDriverOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryDriver | null>(null);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const form = useForm<DriverForm>({ defaultValues: { name: "", phone: "", vehicle: "", isActive: true } });

  const center = cityCoords[(pharmacy?.city ?? "mumbai").toLowerCase()] ?? cityCoords.mumbai;

  const driversQuery = useQuery({
    queryKey: ["drivers"],
    queryFn: () => unwrap<DeliveryDriver[]>(api.get("/delivery/drivers")),
    placeholderData: []
  });
  const liveQuery = useQuery({
    queryKey: ["delivery-live"],
    queryFn: () => unwrap<LiveDelivery[]>(api.get("/delivery/live")),
    placeholderData: [],
    refetchInterval: 30_000
  });
  const historyQuery = useQuery({
    queryKey: ["delivery-history"],
    queryFn: () => unwrap<DeliveryHistoryRow[]>(api.get("/delivery/history")),
    placeholderData: []
  });

  useEffect(() => {
    if (editingDriver) {
      form.reset({
        name: editingDriver.name,
        phone: editingDriver.phone,
        vehicle: editingDriver.vehicle,
        isActive: editingDriver.isActive
      });
    } else {
      form.reset({ name: "", phone: "", vehicle: "", isActive: true });
    }
  }, [editingDriver, form]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["drivers"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-live"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-history"] })
    ]);
  };

  const saveDriver = useMutation({
    mutationFn: (values: DriverForm) =>
      editingDriver ? unwrap(api.put(`/delivery/drivers/${editingDriver.id}`, values)) : unwrap(api.post("/delivery/drivers", values)),
    onSuccess: async () => {
      toast.success(editingDriver ? "Driver updated" : "Driver added");
      setDriverOpen(false);
      setEditingDriver(null);
      await invalidate();
    },
    onError: () => toast.error("Driver could not be saved")
  });

  const deleteDriver = useMutation({
    mutationFn: (driverId: string) => unwrap(api.delete(`/delivery/drivers/${driverId}`)),
    onSuccess: async () => {
      toast.success("Driver deactivated");
      setDeleteTarget(null);
      await invalidate();
    },
    onError: () => toast.error("Driver could not be deleted")
  });

  const assignDriver = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) => unwrap(api.post(`/orders/${orderId}/assign-driver`, { driverId })),
    onSuccess: async () => {
      toast.success("Driver assigned");
      await invalidate();
    },
    onError: () => toast.error("Driver could not be assigned")
  });

  const drivers = useMemo(() => driversQuery.data ?? [], [driversQuery.data]);
  const activeDrivers = useMemo(() => drivers.filter((driver) => driver.isActive), [drivers]);
  const live = useMemo(() => liveQuery.data ?? [], [liveQuery.data]);
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  return (
    <section>
      <PageHeader
        title={t("modules.delivery")}
        actions={<Button onClick={() => { setEditingDriver(null); setDriverOpen(true); }}><Plus className="h-4 w-4" /> Driver</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent>
            <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={12} className="h-[520px] rounded-md">
              <TileLayer attribution="OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {live.map((order) => (
                <Marker key={order.orderId} position={[order.customerCoords.lat, order.customerCoords.lng]} icon={pinIcon("order")}>
                  <Popup>
                    <div className="min-w-56 space-y-2">
                      <p className="font-semibold">Order #{order.orderId.slice(-6).toUpperCase()}</p>
                      <p>{order.customerName} · {order.customerPhone}</p>
                      <p>{order.itemsCount} items · {formatCurrency(order.total)}</p>
                      <select
                        className="h-9 w-full rounded-md border border-slate-200 px-2"
                        value={assignSelections[order.orderId] ?? order.driverId ?? ""}
                        onChange={(event) => setAssignSelections((current) => ({ ...current, [order.orderId]: event.target.value }))}
                      >
                        <option value="">Assign driver</option>
                        {activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
                      </select>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const driverId = assignSelections[order.orderId] ?? order.driverId;
                          if (driverId) assignDriver.mutate({ orderId: order.orderId, driverId });
                        }}
                      >
                        Assign
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {drivers.map((driver, index) => (
                <Marker key={driver.id} position={offsetPosition(center, index)} icon={pinIcon("driver", driver.isActive)}>
                  <Popup>
                    <div>
                      <p className="font-semibold">{driver.name}</p>
                      <p>{driver.phone}</p>
                      <p>{driver.vehicle}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-4 font-semibold text-navy-950 dark:text-white">Active Deliveries</h2>
            <div className="space-y-3">
              {live.map((order) => (
                <div key={order.orderId} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy-950 dark:text-white">#{order.orderId.slice(-6).toUpperCase()}</p>
                      <p className="text-sm text-slate-500">{order.customerAddress ?? "Address pending"}</p>
                      <p className="text-sm text-slate-500">{order.driverName ?? "Unassigned"} {order.assignedAt ? `· ${formatDateTime(order.assignedAt)}` : ""}</p>
                    </div>
                    <Badge tone="amber">Out</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-4 font-semibold text-navy-950 dark:text-white">Drivers</h2>
            <Table>
              <thead><tr>{["Name", "Phone", "Vehicle", t("common.status"), t("common.actions")].map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <Td>{driver.name}</Td>
                    <Td>{driver.phone}</Td>
                    <Td>{driver.vehicle}</Td>
                    <Td><Badge tone={driver.isActive ? "teal" : "slate"}>{driver.isActive ? "Active" : "Inactive"}</Badge></Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingDriver(driver); setDriverOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleteTarget(driver)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-4 font-semibold text-navy-950 dark:text-white">Delivery History</h2>
            <Table>
              <thead><tr>{["Order", "Customer", "Driver", "Delivered", "Minutes"].map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <Td>#{row.order?.id.slice(-6).toUpperCase()}</Td>
                    <Td>{row.order?.customer?.name ?? "Customer"}</Td>
                    <Td>{row.driver?.name ?? "Driver"}</Td>
                    <Td>{row.deliveredAt ? formatDateTime(row.deliveredAt) : "Pending"}</Td>
                    <Td>{deliveryMinutes(row) ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Modal open={driverOpen} title={editingDriver ? "Edit Driver" : "Add Driver"} onClose={() => { setDriverOpen(false); setEditingDriver(null); }}>
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => saveDriver.mutate(values))}>
          <Input placeholder="Name" {...form.register("name", { required: true })} />
          <Input placeholder="Phone" {...form.register("phone", { required: true })} />
          <Input placeholder="Vehicle" {...form.register("vehicle", { required: true })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("isActive")} /> Active
          </label>
          <Button type="submit" disabled={saveDriver.isPending}>Save</Button>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Deactivate Driver" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Deactivate {deleteTarget?.name}? Existing delivery history remains intact.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteTarget && deleteDriver.mutate(deleteTarget.id)} disabled={deleteDriver.isPending}>Deactivate</Button>
        </div>
      </Modal>
    </section>
  );
};
