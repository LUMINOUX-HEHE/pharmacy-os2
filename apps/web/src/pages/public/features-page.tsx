import { Badge, Button } from "@pharmacy-os/ui";
import { BarChart3, Check, CreditCard, MessageCircle, Package, ShoppingBag, Truck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PublicLayout } from "./public-layout";

const features = [
  {
    icon: Package,
    title: "Inventory",
    summary: "Batch, SKU, barcode, expiry, reorder, schedule, and online visibility in one medicine ledger.",
    bullets: ["CSV import/export", "Expiry and low-stock queues", "Barcode label printing", "Storefront visibility controls"]
  },
  {
    icon: CreditCard,
    title: "Billing",
    summary: "Fast counter billing with GST calculation, credit ledger handling, UPI QR, offline queue, and PDF invoices.",
    bullets: ["Cart builder", "Discount and GST split", "Offline sync", "Invoice PDF download"]
  },
  {
    icon: ShoppingBag,
    title: "E-Commerce",
    summary: "A customer-facing storefront for local medicine orders with prescription upload and order tracking.",
    bullets: ["Searchable catalogue", "OTP checkout", "Razorpay or cash", "Status timeline"]
  },
  {
    icon: Users,
    title: "CRM",
    summary: "Customer profiles with purchase history, khata credit, tags, and refill journeys.",
    bullets: ["Credit balance", "Dormant filters", "Payment links", "WhatsApp templates"]
  },
  {
    icon: BarChart3,
    title: "Analytics",
    summary: "Operational analytics for revenue, profit, expiry risk, top sellers, dead stock, and GST-ready exports.",
    bullets: ["Revenue trend", "Category mix", "GSTR-1 data", "Stock valuation"]
  },
  {
    icon: Truck,
    title: "Delivery",
    summary: "Driver management, order assignment, and real-time delivery location events.",
    bullets: ["Driver roster", "Map view", "Live status", "Socket.io updates"]
  },
  {
    icon: MessageCircle,
    title: "Automation",
    summary: "Background jobs for refills, reorder alerts, expiry notices, reports, and WhatsApp notifications.",
    bullets: ["Bull queues", "Twilio WhatsApp", "Email fallbacks", "In-app alerts"]
  }
] as const;

export const FeaturesPage = () => {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <main className="mx-auto max-w-7xl px-4 py-16">
        <Badge tone="teal">Complete pharmacy workflows</Badge>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold">{t("landing.featuresTitle")}</h1>
        <div className="mt-10 space-y-6">
          {features.map((feature, index) => (
            <section key={feature.title} className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-soft lg:grid-cols-[0.9fr_1.1fr] dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col justify-between">
                <div>
                  <feature.icon className="h-9 w-9 text-teal-500" />
                  <h2 className="mt-5 font-display text-3xl font-bold">{feature.title}</h2>
                  <p className="mt-3 text-slate-600 dark:text-slate-300">{feature.summary}</p>
                </div>
                <Button className="mt-6 w-fit">
                  <Link to="/auth/signup">Start with {feature.title}</Link>
                </Button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="rounded-md bg-navy-950 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{feature.title} console</span>
                    <Badge tone="teal">{index % 2 === 0 ? "Live" : "Automated"}</Badge>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {feature.bullets.map((bullet) => (
                      <div key={bullet} className="rounded-md bg-white/10 p-4 text-sm">
                        <Check className="h-4 w-4 text-teal-300" />
                        <p className="mt-3">{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
    </PublicLayout>
  );
};
