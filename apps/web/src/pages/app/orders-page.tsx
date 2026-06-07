import { closestCenter, DndContext, PointerSensor, type DragEndEvent, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { OrderStatus } from "@pharmacy-os/types";
import type { DeliveryDriver, Medicine, Order, OrderItem } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Modal, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency, formatDateTime } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronDown, LayoutGrid, List, MessageCircle, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";

type ViewMode = "kanban" | "list";
type SortKey = "id" | "patient" | "status" | "total" | "createdAt";

interface OrderTimelineRecord {
  id?: string;
  status: OrderStatus;
  note?: string | null;
  timestamp?: string;
  createdAt?: string;
}

interface OrderDetails extends Omit<Order, "items" | "timeline"> {
  items?: (OrderItem & { medicine?: Medicine })[];
  timeline?: OrderTimelineRecord[];
  deliveryDriver?: DeliveryDriver | null;
  delivery?: {
    id: string;
    status: string;
    assignedAt: string;
    deliveredAt: string | null;
  } | null;
}

const columns: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED
];

const statusTone = (status: OrderStatus): "teal" | "amber" | "rose" | "slate" => {
  if (status === OrderStatus.DELIVERED) return "teal";
  if (status === OrderStatus.CANCELLED) return "rose";
  if (status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.PREPARING) return "amber";
  return "slate";
};

const statusLabel = (status: OrderStatus): string => status.replaceAll("_", " ");

const sortOrders = (orders: OrderDetails[], key: SortKey, direction: "asc" | "desc"): OrderDetails[] => {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...orders].sort((a, b) => {
    const values: Record<SortKey, [string | number, string | number]> = {
      id: [a.id, b.id],
      patient: [a.customer?.name ?? "", b.customer?.name ?? ""],
      status: [a.status, b.status],
      total: [a.total, b.total],
      createdAt: [a.createdAt, b.createdAt]
    };
    const [left, right] = values[key];
    if (typeof left === "number" && typeof right === "number") return (left - right) * multiplier;
    return String(left).localeCompare(String(right)) * multiplier;
  });
};

interface OrderCardProps {
  order: OrderDetails;
  onOpen: (orderId: string) => void;
  onNotify: (orderId: string) => void;
  notifying: boolean;
}

const OrderCard = ({ order, onOpen, onNotify, notifying }: OrderCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
    data: { status: order.status }
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.65 : 1, y: 0 }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="w-full rounded-md border border-slate-200 bg-white p-3 text-left shadow-soft transition hover:border-teal-300 hover:bg-teal-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-navy-950 dark:text-white">#{order.id.slice(-6).toUpperCase()}</p>
          <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {order.customer?.name ?? "Customer"} · {order.items?.length ?? 0} items
        </p>
        <p className="mt-2 font-bold text-navy-950 dark:text-white">{formatCurrency(order.total)}</p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onNotify(order.id);
            }}
            disabled={notifying}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(order.id);
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </button>
    </motion.div>
  );
};

interface StatusColumnProps {
  status: OrderStatus;
  orders: OrderDetails[];
  onOpen: (orderId: string) => void;
  onNotify: (orderId: string) => void;
  notifying: boolean;
}

const StatusColumn = ({ status, orders, onOpen, onNotify, notifying }: StatusColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-950 dark:text-white">{statusLabel(status)}</h2>
          <Badge tone={isOver ? "teal" : "slate"}>{orders.length}</Badge>
        </div>
        <SortableContext items={orders.map((order) => order.id)} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className="min-h-32 space-y-3 rounded-md border border-dashed border-transparent transition data-[over=true]:border-teal-300 data-[over=true]:bg-teal-50/50 dark:data-[over=true]:border-teal-500/30 dark:data-[over=true]:bg-teal-500/10"
            data-over={isOver}
          >
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onOpen={onOpen} onNotify={onNotify} notifying={notifying} />
            ))}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
};

export const OrdersPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("kanban");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => unwrap<OrderDetails[]>(api.get("/orders")),
    placeholderData: []
  });

  const driversQuery = useQuery({
    queryKey: ["delivery-drivers"],
    queryFn: () => unwrap<DeliveryDriver[]>(api.get("/delivery/drivers")),
    placeholderData: []
  });

  const detailQuery = useQuery({
    queryKey: ["orders", selectedOrderId],
    queryFn: () => unwrap<OrderDetails>(api.get(`/orders/${selectedOrderId}`)),
    enabled: Boolean(selectedOrderId)
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => unwrap<OrderDetails>(api.put(`/orders/${id}/status`, { status })),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      const previous = queryClient.getQueryData<OrderDetails[]>(["orders"]);
      queryClient.setQueryData<OrderDetails[]>(["orders"], (orders = []) =>
        orders.map((order) => (order.id === id ? { ...order, status } : order))
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["orders"], context.previous);
      toast.error(error instanceof Error ? error.message : "Order status could not be updated");
    },
    onSuccess: () => toast.success("Order status updated"),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  });

  const assignDriver = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) =>
      unwrap<OrderDetails>(api.post(`/orders/${orderId}/assign-driver`, { driverId })),
    onSuccess: async () => {
      toast.success("Driver assigned");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["orders", selectedOrderId] })
      ]);
    },
    onError: () => toast.error("Driver could not be assigned")
  });

  const notifyCustomer = useMutation({
    mutationFn: (id: string) => unwrap(api.post(`/orders/${id}/notify`)),
    onSuccess: () => toast.success("WhatsApp update sent"),
    onError: () => toast.error("WhatsApp update failed")
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const grouped = useMemo(
    () => columns.reduce<Record<OrderStatus, OrderDetails[]>>((groups, status) => ({ ...groups, [status]: orders.filter((order) => order.status === status) }), {} as Record<OrderStatus, OrderDetails[]>),
    [orders]
  );
  const sortedOrders = useMemo(() => sortOrders(orders, sortKey, sortDirection), [orders, sortDirection, sortKey]);
  const selectedOrder = detailQuery.data ?? orders.find((order) => order.id === selectedOrderId) ?? null;

  const onDragEnd = (event: DragEndEvent) => {
    const orderId = String(event.active.id);
    const targetStatus = event.over?.data.current?.status as OrderStatus | undefined;
    if (!targetStatus) return;
    const currentOrder = orders.find((order) => order.id === orderId);
    if (!currentOrder || currentOrder.status === targetStatus) return;
    updateStatus.mutate({ id: orderId, status: targetStatus });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "createdAt" || key === "total" ? "desc" : "asc");
  };

  const timeline = selectedOrder?.timeline?.length
    ? selectedOrder.timeline
    : selectedOrder
      ? [{ status: selectedOrder.status, note: "Order created", timestamp: selectedOrder.createdAt }]
      : [];

  return (
    <section>
      <PageHeader
        title={t("modules.orders")}
        actions={
          <Button variant="outline" onClick={() => setView((current) => (current === "kanban" ? "list" : "kanban"))}>
            {view === "kanban" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            {view === "kanban" ? "List View" : "Kanban"}
          </Button>
        }
      />

      {view === "kanban" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="grid gap-4 xl:grid-cols-5">
            {columns.map((status) => (
              <StatusColumn
                key={status}
                status={status}
                orders={grouped[status] ?? []}
                onOpen={setSelectedOrderId}
                onNotify={(orderId) => notifyCustomer.mutate(orderId)}
                notifying={notifyCustomer.isPending}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  {[
                    ["id", "Order"],
                    ["patient", "Customer"],
                    ["status", "Status"],
                    ["total", "Total"],
                    ["createdAt", "Created"]
                  ].map(([key, label]) => (
                    <Th key={key}>
                      <button type="button" onClick={() => toggleSort(key as SortKey)} className="inline-flex items-center gap-1">
                        {label} {sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : null}
                      </button>
                    </Th>
                  ))}
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <tr key={order.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => setSelectedOrderId(order.id)}>
                    <Td>#{order.id.slice(-6).toUpperCase()}</Td>
                    <Td>{order.customer?.name ?? "Customer"}</Td>
                    <Td><Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge></Td>
                    <Td>{formatCurrency(order.total)}</Td>
                    <Td>{formatDateTime(order.createdAt)}</Td>
                    <Td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          notifyCustomer.mutate(order.id);
                        }}
                      >
                        <MessageCircle className="h-4 w-4" /> Notify
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Modal open={Boolean(selectedOrderId)} title={selectedOrder ? `Order #${selectedOrder.id.slice(-6).toUpperCase()}` : "Order"} onClose={() => setSelectedOrderId(null)}>
        {selectedOrder ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                <p className="text-xs uppercase text-slate-500">Customer</p>
                <p className="font-semibold text-navy-950 dark:text-white">{selectedOrder.customer?.name ?? "Customer"}</p>
                <p className="text-sm text-slate-500">{selectedOrder.customer?.phone ?? ""}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                <p className="text-xs uppercase text-slate-500">Status</p>
                <Badge tone={statusTone(selectedOrder.status)}>{statusLabel(selectedOrder.status)}</Badge>
              </div>
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                <p className="text-xs uppercase text-slate-500">Total</p>
                <p className="font-semibold text-navy-950 dark:text-white">{formatCurrency(selectedOrder.total)}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-navy-950 dark:text-white">Items</h3>
              <div className="space-y-2">
                {(selectedOrder.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                    <span>{item.medicine?.name ?? item.medicineId}</span>
                    <span>{item.quantity} × {formatCurrency(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedOrder.prescriptionUrl ? (
              <img src={selectedOrder.prescriptionUrl} alt="Prescription" className="max-h-72 w-full rounded-md object-contain ring-1 ring-slate-200 dark:ring-slate-800" />
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-navy-950 dark:text-white">Assign Driver</h3>
              <div className="flex gap-2">
                <select
                  className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  value={selectedOrder.deliveryDriverId ?? ""}
                  onChange={(event) => {
                    if (event.target.value) assignDriver.mutate({ orderId: selectedOrder.id, driverId: event.target.value });
                  }}
                >
                  <option value="">Select driver</option>
                  {(driversQuery.data ?? []).map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {driver.phone}</option>)}
                </select>
                <Button variant="outline" onClick={() => selectedOrder.deliveryDriverId && assignDriver.mutate({ orderId: selectedOrder.id, driverId: selectedOrder.deliveryDriverId })}>
                  <Truck className="h-4 w-4" /> Assign
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-navy-950 dark:text-white">Timeline</h3>
              <div className="space-y-3">
                {timeline.map((entry, index) => (
                  <div key={entry.id ?? `${entry.status}-${index}`} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-500" />
                    <div>
                      <p className="text-sm font-semibold text-navy-950 dark:text-white">{statusLabel(entry.status)}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt ?? entry.timestamp ?? selectedOrder.createdAt)}</p>
                      {entry.note ? <p className="text-sm text-slate-500">{entry.note}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => notifyCustomer.mutate(selectedOrder.id)} disabled={notifyCustomer.isPending}>
                <MessageCircle className="h-4 w-4" /> WhatsApp notify
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">Loading order...</div>
        )}
      </Modal>
    </section>
  );
};
