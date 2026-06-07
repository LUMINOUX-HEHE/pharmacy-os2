import { Button, Card, CardContent } from "@pharmacy-os/ui";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";


import { api } from "../../lib/api";

import { AuthShell } from "./auth-shell";

export const VerifyEmailPage = () => {
  const { token = "" } = useParams();
  const [status, setStatus] = useState("Verifying email");

  useEffect(() => {
    api
      .get(`/auth/verify-email/${token}`)
      .then(() => { setStatus("Email verified"); })
      .catch(() => { setStatus("Verification link expired"); });
  }, [token]);

  return (
    <AuthShell>
      <Card>
        <CardContent>
          <h1 className="font-display text-3xl font-bold">{status}</h1>
          {status.includes("expired") ? (
            <Button className="mt-6">
              <Link to="/auth/forgot-password">Resend verification link</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </AuthShell>
  );
};
