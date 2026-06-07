import { Button, Card, CardContent, Input } from "@pharmacy-os/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";


import { api } from "../../lib/api";

import { AuthShell } from "./auth-shell";

export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const form = useForm<{ password: string; confirm: string }>();

  useEffect(() => {
    if (token.length < 16) {
      const invalidTokenSync = window.setTimeout(() => setTokenStatus("invalid"), 0);
      return () => window.clearTimeout(invalidTokenSync);
    }
    api
      .get(`/auth/reset-password/validate/${token}`)
      .then(() => { setTokenStatus("valid"); })
      .catch(() => { setTokenStatus("invalid"); });
  }, [token]);

  return (
    <AuthShell>
      <Card>
        <CardContent>
          <h1 className="font-display text-3xl font-bold">{t("auth.resetTitle")}</h1>
          {tokenStatus === "checking" ? <p className="mt-4 text-sm text-slate-500">Checking reset link...</p> : null}
          {tokenStatus === "invalid" ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">This reset link is invalid or expired.</p> : null}
          <form
            className="mt-6 space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              if (values.password !== values.confirm) {
                toast.error("Passwords must match");
                return;
              }
              await api.post("/auth/reset-password", { token, password: values.password });
              toast.success("Password updated");
              navigate("/auth/login");
            })}
          >
            <Input type="password" placeholder={t("auth.password")} {...form.register("password", { required: true })} />
            <Input type="password" placeholder={t("auth.confirmPassword")} {...form.register("confirm", { required: true })} />
            <Button type="submit" className="w-full" disabled={tokenStatus !== "valid"}>{t("common.save")}</Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
};
