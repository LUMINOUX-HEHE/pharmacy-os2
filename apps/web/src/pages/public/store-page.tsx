import { MedicineCategory, PaymentMode, ScheduleType } from "@pharmacy-os/types";
import type { Medicine, Order, Pharmacy } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input } from "@pharmacy-os/ui";
import { formatCurrency, formatDateTime } from "@pharmacy-os/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { api, unwrap } from "../../lib/api";

interface StorefrontResponse extends Pharmacy {
  medicines: Medicine[];
  storeSetting?: {
    bannerUrl: string | null;
    description: string;
    deliveryFee: number;
    minimumOrderValue: number;
  } | null;
}

interface CartItem {
  medicine: Medicine;
  quantity: number;
}

interface CheckoutForm {
  customerName: string;
  phone: string;
  otp: string;
  address: string;
  paymentMode: PaymentMode;
}

interface StoreOrder extends Order {
  razorpay?: { id: string; amount: number; currency: string; devMode: boolean } | null;
}

interface TrackingForm {
  orderId: string;
  phone: string;
  otp: string;
}

const priceFor = (medicine: Medicine): number => medicine.onlinePrice ?? medicine.mrp;

export const PublicStorePage = () => {
  const { pharmacySlug = "sharma-medical" } = useParams();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MedicineCategory | "">("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<StoreOrder | null>(null);
  const [trackingOtpSent, setTrackingOtpSent] = useState(false);
  const [trackingDevOtp, setTrackingDevOtp] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<StoreOrder | null>(null);
  const form = useForm<CheckoutForm>({ defaultValues: { customerName: "", phone: "", address: "", otp: "", paymentMode: PaymentMode.CASH } });
  const trackingForm = useForm<TrackingForm>({ defaultValues: { orderId: "", phone: "", otp: "" } });

  const storeQuery = useQuery({
    queryKey: ["store", pharmacySlug],
    queryFn: () => unwrap<StorefrontResponse>(api.get(`/store/${pharmacySlug}`))
  });

  const medicinesQuery = useQuery({
    queryKey: ["store-medicines", pharmacySlug, search, category],
    queryFn: () => unwrap<Medicine[]>(api.get(`/store/${pharmacySlug}/medicines`, { params: { search: search || undefined, category: category || undefined } })),
    placeholderData: storeQuery.data?.medicines ?? []
  });

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (confirmation) {
      trackingForm.setValue("orderId", confirmation.id);
      trackingForm.setValue("phone", confirmation.customer?.phone ?? form.getValues("phone"));
    }
  }, [confirmation, form, trackingForm]);

  const sendOtp = useMutation({
    mutationFn: (phone: string) => unwrap<{ otp?: string }>(api.post("/auth/verify-phone", { phone })),
    onSuccess: (result) => {
      setOtpSent(true);
      setDevOtp(result.otp ?? null);
      toast.success("OTP sent");
    },
    onError: () => toast.error("OTP could not be sent")
  });

  const verifyOtp = useMutation({
    mutationFn: (values: { phone: string; otp: string }) => unwrap(api.post("/auth/verify-phone", values)),
    onSuccess: () => {
      setOtpVerified(true);
      toast.success("Phone verified");
    },
    onError: () => toast.error("OTP verification failed")
  });

  const uploadPrescription = useMutation({
    mutationFn: async (file: File) => {
      const data = new FormData();
      data.append("file", file);
      return unwrap<{ url: string }>(api.post(`/store/${pharmacySlug}/prescription`, data, { headers: { "Content-Type": "multipart/form-data" } }));
    },
    onSuccess: (response) => {
      setPrescriptionUrl(response.url);
      toast.success("Prescription uploaded");
    },
    onError: () => toast.error("Prescription upload failed")
  });

  const checkout = useMutation({
    mutationFn: (values: CheckoutForm) =>
      unwrap<StoreOrder>(
        api.post(`/store/${pharmacySlug}/orders`, {
          ...values,
          prescriptionUrl,
          items: cart.map((item) => ({ medicineId: item.medicine.id, quantity: item.quantity }))
        })
      ),
    onSuccess: (order) => {
      setConfirmation(order);
      setCart([]);
      toast.success("Order placed");
      if (order.razorpay) toast.success(`Razorpay order ready: ${order.razorpay.id}`);
    },
    onError: () => toast.error("Order could not be placed")
  });

  const sendTrackingOtp = useMutation({
    mutationFn: (phone: string) => unwrap<{ otp?: string }>(api.post("/auth/verify-phone", { phone })),
    onSuccess: (result) => {
      setTrackingOtpSent(true);
      setTrackingDevOtp(result.otp ?? null);
      toast.success("Tracking OTP sent");
    }
  });

  const trackOrder = useMutation({
    mutationFn: async (values: TrackingForm) => {
      await unwrap(api.post("/auth/verify-phone", { phone: values.phone, otp: values.otp }));
      return unwrap<StoreOrder>(api.get(`/store/${pharmacySlug}/orders/${values.orderId}`));
    },
    onSuccess: setTrackedOrder,
    onError: () => toast.error("Order tracking verification failed")
  });

  const medicines = useMemo(() => medicinesQuery.data ?? [], [medicinesQuery.data]);
  const categories = Object.values(MedicineCategory);
  const subtotal = cart.reduce((sum, item) => sum + priceFor(item.medicine) * item.quantity, 0);
  const deliveryFee = storeQuery.data?.storeSetting?.deliveryFee ?? 0;
  const total = subtotal + (cart.length > 0 ? deliveryFee : 0);
  const requiresPrescription = cart.some((item) => [ScheduleType.H, ScheduleType.H1, ScheduleType.X].includes(item.medicine.scheduleType));
  const selectedCategoryCount = useMemo(() => medicines.filter((medicine) => !category || medicine.category === category).length, [category, medicines]);

  const addToCart = (medicine: Medicine) => {
    setCart((items) => {
      const existing = items.find((item) => item.medicine.id === medicine.id);
      if (existing) return items.map((item) => item.medicine.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...items, { medicine, quantity: 1 }];
    });
  };

  const submitCheckout = (values: CheckoutForm) => {
    if (!otpVerified) {
      toast.error("Verify phone OTP before checkout");
      return;
    }
    if (requiresPrescription && !prescriptionUrl) {
      toast.error("Prescription is required for scheduled medicines");
      return;
    }
    checkout.mutate(values);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-navy-950 dark:bg-slate-950 dark:text-white">
      <section
        className="bg-navy-950 px-4 py-10 text-white"
        style={storeQuery.data?.storeSetting?.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,22,40,.92), rgba(10,22,40,.62)), url(${storeQuery.data.storeSetting.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-4xl font-bold">{storeQuery.data?.name ?? "Pharmacy Store"}</p>
          <p className="mt-2 text-slate-300">{storeQuery.data?.storeSetting?.description ?? `${storeQuery.data?.city ?? "Mumbai"} · Genuine medicines · Home delivery`}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 lg:grid-cols-[220px_1fr_380px]">
        <aside className="space-y-2">
          <Button variant={category === "" ? "primary" : "outline"} className="w-full justify-start" onClick={() => setCategory("")}>
            All categories
          </Button>
          {categories.map((item) => (
            <Button key={item} variant={category === item ? "primary" : "outline"} className="w-full justify-start" onClick={() => setCategory(item)}>
              {item}
            </Button>
          ))}
        </aside>

        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between gap-3">
              <Input placeholder="Search medicines" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
              <Badge>{selectedCategoryCount} items</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {medicines.map((medicine) => (
                <div key={medicine.id} className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{medicine.name}</p>
                      <p className="text-sm text-slate-500">{medicine.genericName}</p>
                    </div>
                    <Badge tone={medicine.stockQty > 0 ? "teal" : "rose"}>{medicine.stockQty > 0 ? "In stock" : "Out"}</Badge>
                  </div>
                  <p className="mt-3 text-xl font-bold">{formatCurrency(priceFor(medicine))}</p>
                  {[ScheduleType.H, ScheduleType.H1, ScheduleType.X].includes(medicine.scheduleType) ? <Badge tone="amber" className="mt-2">Prescription</Badge> : null}
                  <Button className="mt-4 w-full" onClick={() => addToCart(medicine)} disabled={medicine.stockQty <= 0}>
                    <ShoppingCart className="h-4 w-4" /> Add to cart
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardContent>
            <h2 className="font-semibold">Cart</h2>
            <div className="mt-4 space-y-2">
              {cart.map((item) => (
                <div key={item.medicine.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                  <span>{item.medicine.name}</span>
                  <span>{formatCurrency(priceFor(item.medicine) * item.quantity)}</span>
                  <div className="col-span-2 flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCart((items) => items.map((row) => row.medicine.id === item.medicine.id ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row))}><Minus className="h-4 w-4" /></Button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <Button variant="outline" size="icon" onClick={() => addToCart(item.medicine)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <form className="mt-5 space-y-3" onSubmit={form.handleSubmit(submitCheckout)}>
              <Input placeholder="Name" {...form.register("customerName", { required: true })} />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input placeholder="Phone" {...form.register("phone", { required: true, onChange: () => setOtpVerified(false) })} />
                <Button type="button" variant="outline" onClick={() => sendOtp.mutate(form.getValues("phone"))} disabled={sendOtp.isPending}>Send OTP</Button>
              </div>
              {otpSent ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input placeholder={devOtp ? `OTP ${devOtp}` : "OTP"} {...form.register("otp", { required: true })} />
                  <Button type="button" variant="outline" onClick={() => verifyOtp.mutate({ phone: form.getValues("phone"), otp: form.getValues("otp") })}>Verify</Button>
                </div>
              ) : null}
              <Input placeholder="Delivery address" {...form.register("address", { required: true })} />
              <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" {...form.register("paymentMode")}>
                <option value={PaymentMode.CASH}>COD</option>
                <option value={PaymentMode.UPI}>UPI</option>
                <option value={PaymentMode.CARD}>Card</option>
              </select>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadPrescription.mutate(file); }} />
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> {prescriptionUrl ? "Prescription uploaded" : "Upload prescription"}
              </Button>
              <p className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></p>
              <p className="flex justify-between text-sm"><span>Delivery</span><span>{formatCurrency(cart.length > 0 ? deliveryFee : 0)}</span></p>
              <p className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(total)}</span></p>
              <Button type="submit" className="w-full" disabled={cart.length === 0 || checkout.isPending}>Confirm order</Button>
            </form>

            {confirmation ? (
              <div className="mt-4 rounded-md bg-teal-50 p-3 text-sm text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
                <p className="font-semibold">Order confirmed #{confirmation.id.slice(-6).toUpperCase()}</p>
                {confirmation.razorpay ? <p>Razorpay order {confirmation.razorpay.id}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10">
        <Card>
          <CardContent>
            <h2 className="font-semibold">Track Order</h2>
            <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] lg:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={trackingForm.handleSubmit((values) => trackOrder.mutate(values))}>
              <Input placeholder="Order ID" {...trackingForm.register("orderId", { required: true })} />
              <Input placeholder="Phone" {...trackingForm.register("phone", { required: true })} />
              <Input placeholder={trackingDevOtp ? `OTP ${trackingDevOtp}` : "OTP"} {...trackingForm.register("otp", { required: true })} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => sendTrackingOtp.mutate(trackingForm.getValues("phone"))}>{trackingOtpSent ? "Resend" : "Send OTP"}</Button>
                <Button type="submit">Track</Button>
              </div>
            </form>
            {trackedOrder ? (
              <div className="mt-4 rounded-md bg-slate-50 p-4 dark:bg-slate-900">
                <p className="font-semibold">#{trackedOrder.id.slice(-6).toUpperCase()} · {trackedOrder.status}</p>
                <p className="text-sm text-slate-500">{formatCurrency(trackedOrder.total)} · {formatDateTime(trackedOrder.createdAt)}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
};
