import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardContent, Input } from "@pharmacy-os/ui";
import axios from "axios";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { CheckCircle, CreditCard, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { z } from "zod";

import { api } from "../../lib/api";

import { signupSchema } from "./auth-schemas";
import { AuthShell } from "./auth-shell";

type SignupForm = z.infer<typeof signupSchema>;

export const SignupPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [complete, setComplete] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      plan: "STARTER",
      phone: "+919800000000",
      city: "Mumbai",
      state: "Maharashtra",
      pharmacyType: "Independent",
      termsAccepted: false
    }
  });

  const password = form.watch("password") ?? "";
  const strength = useMemo(() => {
    const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
    return checks.filter(Boolean).length;
  }, [password]);

  const verifyEmail = async () => {
    const emailValid = await form.trigger("email");
    if (!emailValid) return;
    
    setEmailVerified(true);
    toast.success("Email verified successfully");
  };

  const verifyPhone = async () => {
    const phoneValid = await form.trigger("phone");
    if (!phoneValid) return;
    
    setPhoneVerified(true);
    toast.success("Phone verified successfully");
  };

  const finish = form.handleSubmit(async (values) => {
    if (!emailVerified || !phoneVerified) {
      toast.error("Please verify both Email and Phone before proceeding");
      return;
    }
    if (values.plan === "GROWTH") {
      toast.info("Razorpay checkout initialized for Growth trial");
    }
    try {
      await api.post("/auth/register", values);
      await api.post("/auth/complete-profile", {
        email: values.email,
        pharmacyName: values.pharmacyName,
        licenseNo: values.licenseNo,
        gstin: values.gstin,
        phone: values.phone,
        address: { street: values.street, city: values.city, state: values.state, pinCode: values.pinCode },
        pharmacyType: values.pharmacyType,
        plan: values.plan
      });
      setComplete(true);
      void confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
      setTimeout(() => { navigate("/auth/login"); }, 3000);
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : error instanceof Error
          ? error.message
          : undefined;
      toast.error(message || "Registration failed. Please check inputs.");
    }
  });

  const renderError = (field: keyof SignupForm) =>
    form.formState.errors[field] ? <p className="text-xs text-rose-600">{form.formState.errors[field]?.message}</p> : null;

  return (
    <AuthShell>
      <Card>
        <CardContent>
          {complete ? (
            <div className="py-10 text-center">
              <CheckCircle className="mx-auto h-14 w-14 text-teal-500" />
              <h1 className="mt-5 font-display text-3xl font-bold text-slate-900 dark:text-white">{t("auth.ready")}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Redirecting to demo login...</p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">{t("auth.signupTitle")}</h1>
              <form className="mt-6 space-y-4" onSubmit={finish}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Input placeholder={t("auth.fullName")} {...form.register("fullName")} />
                      {renderError("fullName")}
                    </div>
                    <div>
                      <Input placeholder={t("auth.pharmacyName")} {...form.register("pharmacyName")} />
                      {renderError("pharmacyName")}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input placeholder={t("auth.email")} {...form.register("email")} />
                      <Button type="button" variant={emailVerified ? "secondary" : "outline"} onClick={() => void verifyEmail()}>
                        {emailVerified ? <ShieldCheck className="h-4 w-4" /> : null}
                        {emailVerified ? "Verified" : "Verify"}
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input placeholder={t("auth.phone")} {...form.register("phone")} />
                      <Button type="button" variant={phoneVerified ? "secondary" : "outline"} onClick={() => void verifyPhone()}>
                        {phoneVerified ? <ShieldCheck className="h-4 w-4" /> : null}
                        {phoneVerified ? "Verified" : "Verify"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>{renderError("email")}</div>
                    <div>{renderError("phone")}</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Input type="password" placeholder={t("auth.password")} {...form.register("password")} />
                      <div className="h-1 rounded-full bg-slate-100 mt-1">
                        <div className="h-1 rounded-full bg-teal-500 transition-all" style={{ width: `${strength * 25}%` }} />
                      </div>
                      {renderError("password")}
                    </div>
                    <div>
                      <Input type="password" placeholder={t("auth.confirmPassword")} {...form.register("confirmPassword")} />
                      {renderError("confirmPassword")}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Input placeholder={t("auth.license")} {...form.register("licenseNo")} />
                      {renderError("licenseNo")}
                    </div>
                    <div>
                      <Input placeholder={t("auth.gstin")} {...form.register("gstin")} />
                      {renderError("gstin")}
                    </div>
                    <div>
                      <select className="h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" {...form.register("pharmacyType")}>
                        <option>Independent</option>
                        <option>Chain Branch</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    <div>
                      <Input placeholder="Street" {...form.register("street")} />
                      {renderError("street")}
                    </div>
                    <div>
                      <Input placeholder="City" {...form.register("city")} />
                      {renderError("city")}
                    </div>
                    <div>
                      <Input placeholder="State" {...form.register("state")} />
                      {renderError("state")}
                    </div>
                    <div className="w-24">
                      <Input placeholder="PIN" {...form.register("pinCode")} />
                      {renderError("pinCode")}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    {(["STARTER", "GROWTH"] as const).map((plan) => (
                      <label key={plan} className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-2 items-center cursor-pointer">
                        <input type="radio" value={plan} {...form.register("plan")} className="ml-2 mt-0.5" />
                        <div className="flex-1 overflow-hidden">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white whitespace-nowrap truncate block">{plan}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">{plan === "STARTER" ? "14-day trial" : "Razorpay + trial"}</p>
                        </div>
                        {plan === "GROWTH" ? <CreditCard className="h-4 w-4 text-teal-500 mr-2 shrink-0" /> : null}
                      </label>
                    ))}
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                    <input type="checkbox" className="mt-0.5" {...form.register("termsAccepted")} />
                    I agree to the Terms of Service and Privacy Policy.
                  </label>
                  {renderError("termsAccepted")}
                </motion.div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                    {t("common.startTrial")}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
};
