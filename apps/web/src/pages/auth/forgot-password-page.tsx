import { Button, Card, CardContent, Input } from "@pharmacy-os/ui";
import { maskEmail } from "@pharmacy-os/utils";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";


import { api } from "../../lib/api";

import { AuthShell } from "./auth-shell";

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<{ email: string }>();

  return (
    <AuthShell>
      <Card>
        <CardContent>
          <h1 className="font-display text-3xl font-bold">{t("auth.forgotTitle")}</h1>
          {sentTo ? (
            <p className="mt-6 text-slate-600">Reset link sent to {maskEmail(sentTo)}</p>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                await api.post("/auth/forgot-password", values);
                setSentTo(values.email);
              })}
            >
              <Input placeholder={t("auth.email")} {...form.register("email", { required: true })} />
              <Button type="submit" className="w-full">{t("common.submit")}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
};
