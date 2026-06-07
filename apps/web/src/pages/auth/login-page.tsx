import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardContent, Input } from "@pharmacy-os/ui";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AxiosError } from "axios";
import type { z } from "zod";


import { useAuthStore } from "../../features/auth/auth-store";

import { loginSchema } from "./auth-schemas";
import { AuthShell } from "./auth-shell";

type LoginFormInput = z.input<typeof loginSchema>;
type LoginForm = z.output<typeof loginSchema>;

export const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<LoginFormInput, unknown, LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@demo.com", password: "Demo@1234", remember: true }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitError(null);
      const promise = login(values.email, values.password);
      toast.promise(promise, {
        loading: t("common.loading"),
        success: "Signed in",
        error: "Invalid credentials"
      });
      await promise;
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data?.message) {
        setSubmitError(error.response.data.message);
      } else {
        setSubmitError(t("auth.invalidCredentials"));
      }
    }
  });

  return (
    <AuthShell>
      <Card>
        <CardContent>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">{t("auth.loginTitle")}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("auth.loginSubtitle")}</p>
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <Input placeholder={t("auth.email")} {...form.register("email")} />
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} placeholder={t("auth.password")} {...form.register("password")} />
              <button type="button" className="absolute right-3 top-2.5 text-slate-400" onClick={() => { setShowPassword((value) => !value); }}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {form.formState.errors.email ? <p className="text-xs text-rose-600">{form.formState.errors.email.message}</p> : null}
            {form.formState.errors.password ? <p className="text-xs text-rose-600">{form.formState.errors.password.message}</p> : null}
            {submitError ? <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{submitError}</p> : null}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input type="checkbox" {...form.register("remember")} /> {t("auth.remember")}
              </label>
              <Link to="/auth/forgot-password" className="font-semibold text-teal-700 dark:text-teal-400">
                {t("auth.forgot")}
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {t("auth.loginTitle")}
            </Button>
            <Button variant="outline" className="w-full">
              {t("auth.google")}
            </Button>
          </form>
          <Link to="/auth/signup" className="mt-5 block text-center text-sm font-semibold text-teal-700 dark:text-teal-400">
            {t("auth.noAccount")}
          </Link>
        </CardContent>
      </Card>
    </AuthShell>
  );
};
