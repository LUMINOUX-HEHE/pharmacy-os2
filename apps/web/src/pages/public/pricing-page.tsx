import { Badge, Button, Card, CardContent, Table, Td, Th } from "@pharmacy-os/ui";
import { Check, IndianRupee } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PublicLayout } from "./public-layout";

const plans = [
  {
    name: "Starter",
    monthly: 1499,
    annual: 14990,
    description: "For a single counter going digital for the first time.",
    features: ["POS billing", "Inventory and expiry alerts", "50 customer reminders", "PDF invoices"]
  },
  {
    name: "Growth",
    monthly: 2999,
    annual: 29990,
    description: "For pharmacies adding online orders and repeat-customer journeys.",
    features: ["Everything in Starter", "Public storefront", "WhatsApp automation", "Razorpay payments"]
  },
  {
    name: "Enterprise",
    monthly: 7999,
    annual: 79990,
    description: "For multi-branch operators and high-volume medicine counters.",
    features: ["Multi-branch controls", "Advanced analytics exports", "Priority support", "Custom integrations"]
  }
] as const;

const comparison = [
  ["GST billing", "Yes", "Yes", "Yes"],
  ["Offline POS queue", "Yes", "Yes", "Yes"],
  ["Public storefront", "No", "Yes", "Yes"],
  ["WhatsApp reminders", "Limited", "Unlimited", "Unlimited"],
  ["Cloudinary uploads", "Prescriptions", "Prescriptions + logo", "Custom folders"],
  ["Razorpay subscriptions", "Trial only", "Yes", "Yes"],
  ["Bull background reports", "No", "Yes", "Priority"],
  ["Support", "Email", "Email + phone", "Dedicated manager"]
] as const;

export const PricingPage = () => {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);

  return (
    <PublicLayout>
      <main className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="teal">Transparent INR pricing</Badge>
            <h1 className="mt-4 font-display text-5xl font-bold">{t("landing.pricingTitle")}</h1>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
              Start with the workflows you need today, then unlock online ordering, WhatsApp automation, and analytics when the store is ready.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-soft dark:border-slate-800 dark:bg-slate-950">
            Monthly
            <input type="checkbox" checked={annual} onChange={(event) => { setAnnual(event.target.checked); }} />
            Annual
          </label>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Card key={plan.name} className={index === 1 ? "border-teal-300 shadow-glow-teal" : undefined}>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-3xl font-bold">{plan.name}</h2>
                  {index === 1 ? <Badge tone="teal">Most Popular</Badge> : null}
                </div>
                <p className="mt-3 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-6 flex items-end gap-1 text-4xl font-bold">
                  <IndianRupee className="mb-1 h-7 w-7" />
                  {(annual ? plan.annual : plan.monthly).toLocaleString("en-IN")}
                  <span className="text-sm font-semibold text-slate-500">/{annual ? "year" : "month"}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">GST extra. Annual billing includes two months free.</p>
                <div className="mt-6 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <p key={feature} className="flex gap-2">
                      <Check className="h-4 w-4 text-teal-500" /> {feature}
                    </p>
                  ))}
                </div>
                <Button className="mt-7 w-full">
                  <Link to="/auth/signup">Choose {plan.name}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-10">
          <CardContent>
            <h2 className="font-display text-2xl font-bold">Feature comparison</h2>
            <div className="mt-5 overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    {["Feature", "Starter", "Growth", "Enterprise"].map((header) => (
                      <Th key={header}>{header}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell) => (
                        <Td key={`${row[0]}-${cell}`}>{cell}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </PublicLayout>
  );
};
