import { Badge, Button, Card, CardContent, Modal } from "@pharmacy-os/ui";
import { motion } from "framer-motion";
import {
  BarChart3,
  Check,
  ChevronDown,
  CreditCard,
  LineChart,
  MessageCircle,
  Package,
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PublicLayout } from "./public-layout";

const modules = [
  {
    icon: Package,
    label: "Inventory",
    value: "12 low stock alerts",
    points: ["Batch-wise stock", "Expiry heatmap", "Auto reorder alerts"]
  },
  {
    icon: CreditCard,
    label: "Billing",
    value: "Rs.48,250 today",
    points: ["GST invoice", "UPI QR", "Offline POS queue"]
  },
  {
    icon: ShoppingBag,
    label: "E-Commerce",
    value: "18 new orders",
    points: ["Public storefront", "Prescription upload", "Live status board"]
  },
  {
    icon: MessageCircle,
    label: "CRM",
    value: "42 reminders queued",
    points: ["Refill reminders", "Khata follow-up", "WhatsApp templates"]
  },
  {
    icon: LineChart,
    label: "Analytics",
    value: "23% profit lift",
    points: ["Revenue trends", "Dead stock", "GSTR exports"]
  }
] as const;

const painPoints = [
  ["Manual billing", "Counter queues, missed GST fields, duplicate invoice work", "One-click GST invoices with stock deduction"],
  ["Lost customers", "Refills depend on memory and paper notebooks", "Automated refill journeys over WhatsApp"],
  ["Dead stock", "Expiry losses discovered after cash is trapped", "Expiry and reorder alerts before money leaks"]
] as const;

const pricingPlans = [
  { name: "Starter", monthly: 1499, annual: 14990, features: ["Billing POS", "Inventory", "Customer ledger"] },
  { name: "Growth", monthly: 2999, annual: 29990, features: ["Everything in Starter", "Storefront", "WhatsApp automation"] },
  { name: "Enterprise", monthly: 7999, annual: 79990, features: ["Multi-branch", "Advanced analytics", "Priority onboarding"] }
] as const;

const stats = [
  ["2,000+", "pharmacies onboarded"],
  ["18.4L", "orders processed"],
  ["Rs.126Cr", "revenue tracked"],
  ["82", "cities covered"]
] as const;

const testimonials = [
  ["Asha Medical", "Mumbai", "Billing, stock, and reminders finally live in one place."],
  ["CarePlus Pharmacy", "Pune", "We recovered dormant customers in the first month."],
  ["Sri Sai Medicals", "Chennai", "The storefront turned phone orders into a clean workflow."]
] as const;

const faqs = [
  ["Can my counter work offline?", "Yes. Billing keeps a local queue and syncs bills once the internet returns."],
  ["Does this support GST invoices?", "Yes. Every bill stores taxable value, GST, discount, and invoice PDF history."],
  ["Can customers order online?", "Yes. Each pharmacy gets a public storefront with prescription upload and order tracking."],
  ["Is WhatsApp included?", "Yes. Twilio WhatsApp is wired for order updates, refills, payment links, and alerts."],
  ["Can I migrate from Excel?", "Yes. Inventory CSV import is supported and seed data mirrors the production schema."],
  ["Can staff have limited access?", "Yes. Owner, manager, billing, and delivery roles are enforced on API routes."],
  ["Does it connect to Razorpay?", "Yes. Orders, subscriptions, payment links, and webhooks are part of the backend."],
  ["Can I upload prescriptions?", "Yes. The upload API streams prescriptions and logos through Cloudinary or a local dev URL."],
  ["Which languages are supported?", "English, Hindi, Marathi, and Tamil are available from the language switcher."],
  ["How fast can we start?", "The demo account works immediately, and the signup wizard creates a trial pharmacy."]
] as const;

export const LandingPage = () => {
  const { t } = useTranslation();
  const [activeFeature, setActiveFeature] = useState(0);
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const selectedModule = modules[activeFeature] ?? modules[0];

  const priceSuffix = useMemo(() => (annual ? "/yr" : "/mo"), [annual]);

  return (
    <PublicLayout>
      <section className="mesh-bg clinical-grid overflow-hidden">
        <div className="mx-auto grid min-h-[88vh] max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <Badge tone="teal">{t("landing.trusted")}</Badge>
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold leading-tight tracking-normal text-navy-950 md:text-7xl dark:text-white">
              {t("landing.hero")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">{t("landing.subhero")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg">
                <Link to="/auth/signup">{t("common.startTrial")}</Link>
              </Button>
              <Button variant="outline" size="lg" onClick={() => { setDemoOpen(true); }}>
                <Play className="h-4 w-4" />
                {t("common.watchDemo")}
              </Button>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.55 }}>
            <div className="rounded-xl border border-white/70 bg-white/90 p-3 shadow-hard backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500" />
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="h-3 w-3 rounded-full bg-teal-500" />
                </div>
                <Badge tone="teal">Live dashboard</Badge>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {modules.map((module, index) => (
                  <motion.div
                    key={module.label}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3, delay: index * 0.2, repeat: Infinity }}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <module.icon className="h-5 w-5 text-teal-500" />
                    <p className="mt-4 text-sm text-slate-500">{module.label}</p>
                    <p className="font-semibold">{module.value}</p>
                  </motion.div>
                ))}
                <div className="rounded-lg bg-navy-950 p-4 text-white">
                  <p className="text-sm text-slate-300">Recovery forecast</p>
                  <p className="mt-2 text-3xl font-bold">Rs.4.2L</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                    <motion.div className="h-full rounded-full bg-teal-400" initial={{ width: 0 }} animate={{ width: "78%" }} transition={{ duration: 1 }} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-2xl font-display text-3xl font-bold">{t("landing.problemTitle")}</h2>
          <Badge tone="amber">Rs.4.2L average annual revenue recovered</Badge>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {painPoints.map(([title, oldWay, newWay]) => (
            <Card key={title}>
              <CardContent>
                <ShieldCheck className="h-7 w-7 text-teal-500" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <p className="rounded-md bg-rose-50 p-3 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{oldWay}</p>
                  <p className="rounded-md bg-teal-50 p-3 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">{newWay}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-3xl font-bold">{t("landing.featuresTitle")}</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="grid gap-2">
              {modules.map((module, index) => (
                <button
                  key={module.label}
                  type="button"
                  className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left font-semibold transition ${
                    activeFeature === index
                      ? "border-teal-300 bg-white text-navy-950 shadow-soft"
                      : "border-transparent bg-transparent text-slate-600 hover:bg-white/70 dark:text-slate-300"
                  }`}
                  onClick={() => { setActiveFeature(index); }}
                >
                  <module.icon className="h-5 w-5 text-teal-500" />
                  {module.label}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-hard dark:border-slate-800 dark:bg-slate-950">
              <div className="rounded-lg bg-navy-950 p-5 text-white">
                <div className="flex items-center justify-between">
                  <p className="font-display text-2xl font-bold">{selectedModule.label}</p>
                  <Badge tone="teal">{selectedModule.value}</Badge>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {selectedModule.points.map((point) => (
                    <div key={point} className="rounded-md bg-white/10 p-4">
                      <Check className="h-4 w-4 text-teal-300" />
                      <p className="mt-3 text-sm text-slate-100">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {["Orders", "Revenue", "Alerts"].map((label, index) => (
                  <div key={label} className="rounded-md bg-slate-50 p-4 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-bold">{["128", "Rs.8.4L", "16"][index]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-bold">{t("landing.pricingTitle")}</h2>
          <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-soft">
            Monthly
            <input type="checkbox" checked={annual} onChange={(event) => { setAnnual(event.target.checked); }} />
            Annual
          </label>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <Card key={plan.name} className={index === 1 ? "border-teal-300 shadow-glow-teal" : undefined}>
              <CardContent>
                {index === 1 ? <Badge tone="teal">Most Popular</Badge> : null}
                <h3 className="mt-4 font-display text-2xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold">
                  Rs.{(annual ? plan.annual : plan.monthly).toLocaleString("en-IN")}
                  <span className="text-sm font-semibold text-slate-500">{priceSuffix}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">GST extra. Annual plans save two months.</p>
                <ul className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="h-4 w-4 text-teal-500" /> {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-3xl font-bold">{t("landing.testimonialsTitle")}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {testimonials.map(([name, city, quote]) => (
              <Card key={name} className="border-white/10 bg-white/5">
                <CardContent>
                  <div className="flex text-amber-500">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                  <p className="mt-4 text-slate-200">{quote}</p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-400 font-bold text-navy-950">{name.slice(0, 1)}</span>
                    <p className="font-semibold">
                      {name}, {city}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft dark:border-slate-800 dark:bg-slate-950">
              <p className="font-display text-4xl font-bold text-navy-950 dark:text-white">{value}</p>
              <p className="mt-2 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-500" />
            <h2 className="font-display text-3xl font-bold">{t("landing.integrationsTitle")}</h2>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {["Razorpay", "WhatsApp Business", "Tally", "Cloudinary", "ABDM"].map((logo) => (
              <div key={logo} className="rounded-lg border border-slate-200 bg-white p-5 text-center font-semibold shadow-soft dark:border-slate-800 dark:bg-slate-950">
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="font-display text-3xl font-bold">{t("landing.faqTitle")}</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
          {faqs.map(([question, answer], index) => (
            <button key={question} type="button" className="block w-full p-5 text-left" onClick={() => { setOpenFaq(openFaq === index ? -1 : index); }}>
              <span className="flex items-center justify-between gap-4 font-semibold">
                {question}
                <ChevronDown className={`h-4 w-4 transition ${openFaq === index ? "rotate-180" : ""}`} />
              </span>
              {openFaq === index ? <span className="mt-3 block text-sm text-slate-600 dark:text-slate-300">{answer}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <Modal open={demoOpen} title="Product demo" onClose={() => { setDemoOpen(false); }}>
        <div className="aspect-video rounded-lg bg-navy-950 p-6 text-white">
          <div className="grid h-full place-items-center rounded-md border border-white/10">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-teal-300" />
              <p className="mt-4 font-display text-2xl font-bold">Demo walkthrough</p>
              <p className="mt-2 text-sm text-slate-300">Inventory, POS, storefront, CRM, analytics, and delivery in one operating flow.</p>
            </div>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={() => { setDemoOpen(false); }}>
          <Link to="/auth/signup">Start your trial</Link>
        </Button>
      </Modal>
    </PublicLayout>
  );
};
