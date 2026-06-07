import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardContent, Input } from "@pharmacy-os/ui";
import { Headphones, Mail, MapPin, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { z } from "zod";

import { contactFormSchema } from "./contact-schema";
import { PublicLayout } from "./public-layout";

type ContactForm = z.infer<typeof contactFormSchema>;

export const ContactPage = () => {
  const { t } = useTranslation();
  const form = useForm<ContactForm>({ resolver: zodResolver(contactFormSchema) });

  return (
    <PublicLayout>
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-16 lg:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardContent>
            <h1 className="font-display text-4xl font-bold">Contact Pharmacy OS</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Talk to the team about onboarding, data import, integrations, or pricing.</p>
            <form
              className="mt-8 grid gap-4"
              onSubmit={form.handleSubmit((values) => {
                toast.success(`Message sent for ${values.pharmacyName}`);
                form.reset();
              })}
            >
              {(["name", "email", "pharmacyName", "city"] as const).map((field) => (
                <label key={field} className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {field === "pharmacyName" ? "Pharmacy name" : field.charAt(0).toUpperCase() + field.slice(1)}
                  <Input {...form.register(field)} />
                  {form.formState.errors[field] ? <span className="text-xs text-rose-600">{form.formState.errors[field]?.message}</span> : null}
                </label>
              ))}
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Message
                <textarea
                  className="min-h-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  {...form.register("message")}
                />
                {form.formState.errors.message ? <span className="text-xs text-rose-600">{form.formState.errors.message.message}</span> : null}
              </label>
              <Button type="submit">{t("common.submit")}</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent>
              <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                <iframe
                  className="aspect-video w-full"
                  title="Pharmacy OS Mumbai office map"
                  src="https://www.google.com/maps?q=Mumbai%2C%20India&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="flex items-start gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <MapPin className="mt-1 h-5 w-5 text-teal-500" />
                  <div>
                    <p className="font-semibold text-navy-950 dark:text-white">Mumbai, India</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Remote onboarding for pharmacies across India</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4">
              {[
                [Mail, "support@pharmacyos.in", "Implementation and product support"],
                [Phone, "+91 22 4000 9000", "Sales and onboarding"],
                [Headphones, "Mon-Sat, 9:00-20:00 IST", "Support hours"]
              ].map(([Icon, title, subtitle]) => {
                const IconComponent = Icon as typeof Mail;
                return (
                  <div key={String(title)} className="flex gap-3">
                    <IconComponent className="mt-1 h-5 w-5 text-teal-500" />
                    <div>
                      <p className="font-semibold">{title as string}</p>
                      <p className="text-sm text-slate-500">{subtitle as string}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </main>
    </PublicLayout>
  );
};
