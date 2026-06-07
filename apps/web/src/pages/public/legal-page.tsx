import { PublicLayout } from "./public-layout";

const privacySections = [
  ["Data we process", "Pharmacy OS processes account details, pharmacy profile data, medicine inventory, invoices, prescriptions, customer contact details, delivery data, payment references, and audit logs needed to operate the service."],
  ["How we use data", "We use data to authenticate users, run inventory and billing workflows, generate invoices and reports, send customer reminders, process storefront orders, and maintain security and compliance records."],
  ["Integrations", "Razorpay, Twilio WhatsApp, Cloudinary, email, maps, and hosting providers receive only the data needed for the requested workflow, such as payment IDs, message recipients, file uploads, or delivery status."],
  ["Security", "Traffic is encrypted in transit. API access is protected by role-based permissions, refresh-token rotation, rate limits, audit logs, and least-privilege operational access."],
  ["Retention", "Billing, tax, prescription, and audit records are retained as required for legal, pharmacy, and GST compliance. Storefront customer records can be exported or deactivated by the pharmacy owner."],
  ["Your controls", "Pharmacy owners can update profile data, invite or revoke staff, configure notifications, and request export or deletion support where legally permitted."]
] as const;

const termsSections = [
  ["Service scope", "Pharmacy OS provides software for inventory, billing, CRM, online ordering, delivery operations, analytics, uploads, notifications, and payment workflow orchestration."],
  ["Pharmacy obligations", "The pharmacy remains responsible for lawful dispensing, prescription verification, drug license compliance, GST filings, customer consent, pricing accuracy, and local delivery operations."],
  ["Payments", "Razorpay payment, subscription, refund, chargeback, and settlement rules apply to payment flows. Pharmacy OS stores provider references and webhook outcomes for reconciliation."],
  ["Acceptable use", "Users may not upload unsafe files, misuse WhatsApp or email, bypass role permissions, manipulate invoices, or use the service for prohibited drugs or unlawful sales."],
  ["Availability", "The product includes offline billing support for counter continuity. Cloud, payment, WhatsApp, and upload features depend on provider availability and configured credentials."],
  ["Liability", "The software supports pharmacy workflows but does not replace professional judgment, statutory compliance, accounting review, or medical advice."]
] as const;

export const LegalPage = ({ type }: { type: "privacy" | "terms" }) => {
  const sections = type === "privacy" ? privacySections : termsSections;

  return (
    <PublicLayout>
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Pharmacy OS legal</p>
        <h1 className="mt-4 font-display text-4xl font-bold">{type === "privacy" ? "Privacy Policy" : "Terms of Service"}</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: 4 May 2026</p>
        <div className="mt-8 space-y-7 text-slate-600 dark:text-slate-300">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="font-display text-2xl font-bold text-navy-950 dark:text-white">{title}</h2>
              <p className="mt-2 leading-7">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </PublicLayout>
  );
};
