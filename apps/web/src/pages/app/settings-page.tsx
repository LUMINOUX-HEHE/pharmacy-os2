import { PharmacyPlan, StaffRole } from "@pharmacy-os/types";
import type { Pharmacy, Staff, SubscriptionStatus, User } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input, Modal, Table, Td, Th } from "@pharmacy-os/ui";
import { formatDate } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, MessageCircle, Save, Upload, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";
import { changeLanguage } from "../../lib/i18n";
import { applyTheme, currentTheme, type ThemeMode } from "../../lib/theme-mode";

type Tab = "profile" | "subscription" | "team" | "notifications" | "integrations" | "appearance";

interface AuthMe {
  user: User;
  pharmacy: Pharmacy;
  staff: Staff;
  staffRole: StaffRole;
}

interface StaffRow extends Staff {
  user: User;
}

interface NotificationSettings {
  emailAlerts: boolean;
  whatsappAlerts: boolean;
  inAppAlerts: boolean;
  lowStockThreshold: number;
  expiryWarningDays: number[];
}

interface SubscriptionInfo {
  plan: PharmacyPlan;
  planExpiresAt: string | null;
  daysRemaining: number | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
  } | null;
}

interface ProfileForm {
  name: string;
  licenseNo: string;
  gstin?: string | null;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  logoUrl?: string | null;
}

interface InviteForm {
  email: string;
  role: "MANAGER" | "BILLING" | "DELIVERY";
}

const tabs: { key: Tab; labelKey: string }[] = [
  { key: "profile", labelKey: "settings.pharmacyProfile" },
  { key: "subscription", labelKey: "settings.subscription" },
  { key: "team", labelKey: "settings.team" },
  { key: "notifications", labelKey: "settings.notifications" },
  { key: "integrations", labelKey: "settings.integrations" },
  { key: "appearance", labelKey: "settings.appearance" }
];

const roleMatrix = {
  OWNER: ["Dashboard", "Inventory", "Billing", "Orders", "Customers", "Analytics", "Settings", "Team", "Subscription"],
  MANAGER: ["Dashboard", "Inventory", "Billing", "Orders", "Customers", "Analytics", "Settings"],
  BILLING: ["Billing", "Inventory", "Customers"],
  DELIVERY: ["Delivery", "Orders"]
} as const;

const defaultNotifications: NotificationSettings = {
  emailAlerts: true,
  whatsappAlerts: true,
  inAppAlerts: true,
  lowStockThreshold: 10,
  expiryWarningDays: [7, 14, 30]
};

const isTab = (value: string | undefined): value is Tab => tabs.some((tab) => tab.key === value);

export const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const { tab } = useParams();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement | null>(null);
  const licenseRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => (isTab(tab) ? tab : "profile"));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<StaffRow | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(currentTheme);
  const profileForm = useForm<ProfileForm>();
  const inviteForm = useForm<InviteForm>({ defaultValues: { email: "", role: "BILLING" } });
  const notificationsForm = useForm<NotificationSettings>({ defaultValues: defaultNotifications });

  const meQuery = useQuery({ queryKey: ["auth-me"], queryFn: () => unwrap<AuthMe>(api.get("/auth/me")) });
  const teamQuery = useQuery({ queryKey: ["team"], queryFn: () => unwrap<StaffRow[]>(api.get("/settings/team")), placeholderData: [] });
  const subscriptionQuery = useQuery({ queryKey: ["subscription"], queryFn: () => unwrap<SubscriptionInfo>(api.get("/settings/subscription")) });
  const notificationsQuery = useQuery({ queryKey: ["notification-settings"], queryFn: () => unwrap<NotificationSettings>(api.get("/settings/notifications")) });

  useEffect(() => {
    const pharmacy = meQuery.data?.pharmacy;
    if (!pharmacy) return;
    const previewSync = window.setTimeout(() => {
      setLogoPreview(pharmacy.logoUrl);
    }, 0);
    profileForm.reset({
      name: pharmacy.name,
      licenseNo: pharmacy.licenseNo,
      gstin: pharmacy.gstin ?? "",
      address: pharmacy.address,
      city: pharmacy.city,
      state: pharmacy.state,
      pinCode: pharmacy.pinCode,
      phone: pharmacy.phone,
      logoUrl: pharmacy.logoUrl
    });
    return () => window.clearTimeout(previewSync);
  }, [meQuery.data?.pharmacy, profileForm]);

  useEffect(() => {
    if (notificationsQuery.data) notificationsForm.reset(notificationsQuery.data);
  }, [notificationsForm, notificationsQuery.data]);

  const saveProfile = useMutation({
    mutationFn: (values: ProfileForm) => unwrap<Pharmacy>(api.put("/settings/pharmacy", { ...values, gstin: values.gstin || null })),
    onSuccess: async () => {
      toast.success("Profile saved");
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: () => toast.error("Profile could not be saved")
  });

  const uploadFile = async (endpoint: "/uploads/logo" | "/uploads/prescription", file: File): Promise<string> => {
    const body = new FormData();
    body.append("file", file);
    const response = await unwrap<{ url: string }>(api.post(endpoint, body, { headers: { "Content-Type": "multipart/form-data" } }));
    return response.url;
  };

  const uploadLogo = useMutation({
    mutationFn: (file: File) => uploadFile("/uploads/logo", file),
    onSuccess: (url) => {
      setLogoPreview(url);
      profileForm.setValue("logoUrl", url);
      toast.success("Logo uploaded");
    },
    onError: () => toast.error("Logo upload failed")
  });

  const uploadLicense = useMutation({
    mutationFn: (file: File) => uploadFile("/uploads/prescription", file),
    onSuccess: (url) => {
      setLicenseUrl(url);
      toast.success("Drug license uploaded");
    },
    onError: () => toast.error("Drug license upload failed")
  });

  const inviteStaff = useMutation({
    mutationFn: (values: InviteForm) => unwrap(api.post("/settings/team/invite", values)),
    onSuccess: async () => {
      toast.success("Invitation sent");
      setInviteOpen(false);
      inviteForm.reset({ email: "", role: "BILLING" });
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: () => toast.error("Invitation could not be sent")
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: StaffRole }) => unwrap(api.put(`/settings/team/${id}/role`, { role })),
    onSuccess: async () => {
      toast.success("Role updated");
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: () => toast.error("Role could not be updated")
  });

  const revokeStaff = useMutation({
    mutationFn: (id: string) => unwrap(api.delete(`/settings/team/${id}`)),
    onSuccess: async () => {
      toast.success("Access revoked");
      setRevokeTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: () => toast.error("Access could not be revoked")
  });

  const saveNotifications = useMutation({
    mutationFn: (values: NotificationSettings) => unwrap(api.put("/settings/notifications", values)),
    onSuccess: async () => {
      toast.success("Notification preferences saved");
      await queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
    onError: () => toast.error("Notification preferences could not be saved")
  });

  const upgrade = useMutation({
    mutationFn: (plan: PharmacyPlan) => unwrap(api.post("/settings/subscription/upgrade", { plan })),
    onSuccess: async () => {
      toast.success("Razorpay checkout order created");
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: () => toast.error("Upgrade could not be started")
  });

  const cancelSubscription = useMutation({
    mutationFn: () => unwrap(api.post("/settings/subscription/cancel")),
    onSuccess: async () => {
      toast.success("Subscription cancelled");
      setCancelOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: () => toast.error("Subscription could not be cancelled")
  });

  const testIntegration = useMutation({
    mutationFn: (provider: "whatsapp" | "razorpay") => unwrap(api.post(`/settings/integrations/${provider}/test`)),
    onSuccess: (_data, provider) => toast.success(`${provider} connection tested`),
    onError: () => toast.error("Integration test failed")
  });

  const team = teamQuery.data ?? [];
  const subscription = subscriptionQuery.data;
  const permissionLabels = useMemo(() => Array.from(new Set(Object.values(roleMatrix).flat())), []);

  return (
    <section>
      <PageHeader title={t("modules.settings")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.key} variant={activeTab === tab.key ? "primary" : "outline"} onClick={() => setActiveTab(tab.key)}>
            {t(tab.labelKey)}
          </Button>
        ))}
      </div>

      {activeTab === "profile" ? (
        <Card>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={profileForm.handleSubmit((values) => saveProfile.mutate(values))}>
              <Input placeholder="Pharmacy name" {...profileForm.register("name", { required: true })} />
              <Input placeholder="Phone" {...profileForm.register("phone", { required: true })} />
              <Input placeholder="Drug license number" {...profileForm.register("licenseNo", { required: true })} />
              <Input placeholder="GSTIN" {...profileForm.register("gstin")} />
              <Input placeholder="Address" {...profileForm.register("address", { required: true })} />
              <Input placeholder="City" {...profileForm.register("city", { required: true })} />
              <Input placeholder="State" {...profileForm.register("state", { required: true })} />
              <Input placeholder="PIN code" {...profileForm.register("pinCode", { required: true })} />
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadLogo.mutate(file); }} />
              <input ref={licenseRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadLicense.mutate(file); }} />
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="button" variant="outline" onClick={() => logoRef.current?.click()}><Upload className="h-4 w-4" /> Logo</Button>
                <Button type="button" variant="outline" onClick={() => licenseRef.current?.click()}><Upload className="h-4 w-4" /> Drug license</Button>
                <Button type="submit" disabled={saveProfile.isPending}><Save className="h-4 w-4" /> {t("common.save")}</Button>
              </div>
              {logoPreview ? <img src={logoPreview} alt="Pharmacy logo preview" className="h-20 w-20 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-800" /> : null}
              {licenseUrl ? <a href={licenseUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-teal-700">View uploaded license</a> : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "subscription" ? (
        <Card>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-4 dark:bg-slate-900">
                <p className="text-sm text-slate-500">Current plan</p>
                <p className="mt-1 text-2xl font-bold text-navy-950 dark:text-white">{subscription?.plan ?? "STARTER"}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-4 dark:bg-slate-900">
                <p className="text-sm text-slate-500">Expiry</p>
                <p className="mt-1 font-semibold">{subscription?.planExpiresAt ? formatDate(subscription.planExpiresAt) : "Not set"}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-4 dark:bg-slate-900">
                <p className="text-sm text-slate-500">Days remaining</p>
                <p className="mt-1 font-semibold">{subscription?.daysRemaining ?? "-"}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => upgrade.mutate(PharmacyPlan.GROWTH)} disabled={upgrade.isPending}>Upgrade to Growth</Button>
              <Button onClick={() => upgrade.mutate(PharmacyPlan.ENTERPRISE)} disabled={upgrade.isPending}>Upgrade to Enterprise</Button>
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "team" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardContent>
              <div className="mb-4 flex justify-between gap-3">
                <h2 className="font-semibold text-navy-950 dark:text-white">Team & Access</h2>
                <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invite</Button>
              </div>
              <Table>
                <thead><tr><Th>Email</Th><Th>Role</Th><Th>{t("common.actions")}</Th></tr></thead>
                <tbody>
                  {team.map((staff) => (
                    <tr key={staff.id}>
                      <Td>{staff.user.email}</Td>
                      <Td>
                        <select className="h-9 rounded-md border border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950" value={staff.role} onChange={(event) => changeRole.mutate({ id: staff.id, role: event.target.value as StaffRole })}>
                          {Object.values(StaffRole).map((role) => <option key={role}>{role}</option>)}
                        </select>
                      </Td>
                      <Td><Button variant="ghost" size="sm" onClick={() => setRevokeTarget(staff)}>Revoke</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h2 className="mb-4 font-semibold text-navy-950 dark:text-white">RBAC Matrix</h2>
              <Table>
                <thead><tr><Th>Role</Th>{permissionLabels.map((label) => <Th key={label}>{label}</Th>)}</tr></thead>
                <tbody>
                  {Object.entries(roleMatrix).map(([role, permissions]) => (
                    <tr key={role}>
                      <Td>{role}</Td>
                      {permissionLabels.map((label) => <Td key={label}>{permissions.includes(label as never) ? "Yes" : "No"}</Td>)}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "notifications" ? (
        <Card>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={notificationsForm.handleSubmit((values) => saveNotifications.mutate({ ...values, lowStockThreshold: Number(values.lowStockThreshold), expiryWarningDays: String(values.expiryWarningDays).split(",").map((value) => Number(value.trim())).filter(Boolean) }))}>
              {[
                ["emailAlerts", "Email alerts"],
                ["whatsappAlerts", "WhatsApp alerts"],
                ["inAppAlerts", "In-app alerts"]
              ].map(([field, label]) => (
                <label key={field} className="flex items-center justify-between rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                  {label}<input type="checkbox" {...notificationsForm.register(field as keyof NotificationSettings)} />
                </label>
              ))}
              <Input type="number" placeholder="Low stock threshold" {...notificationsForm.register("lowStockThreshold", { valueAsNumber: true })} />
              <Input placeholder="Expiry warning days, comma separated" {...notificationsForm.register("expiryWarningDays" as never)} />
              <Button type="submit" className="md:col-span-2" disabled={saveNotifications.isPending}>Save notifications</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "integrations" ? (
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="font-semibold text-navy-950 dark:text-white">WhatsApp</h2>
              <Input placeholder="WhatsApp phone" defaultValue={meQuery.data?.pharmacy.phone ?? ""} />
              <Button variant="outline" onClick={() => testIntegration.mutate("whatsapp")}><MessageCircle className="h-4 w-4" /> Send Test Message</Button>
            </div>
            <div className="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="font-semibold text-navy-950 dark:text-white">Razorpay</h2>
              <Input type="password" placeholder="API key" />
              <Input type="password" placeholder="API secret" />
              <Button variant="outline" onClick={() => testIntegration.mutate("razorpay")}><CreditCard className="h-4 w-4" /> Test Payment</Button>
            </div>
            <div className="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="font-semibold text-navy-950 dark:text-white">ABHA/ABDM <Badge tone="teal">Ready</Badge></h2>
              <Input placeholder="HIP ID" defaultValue={`${meQuery.data?.pharmacy.slug ?? "sharma-medical"}@pharmacyos`} />
              <Input placeholder="Facility registry ID" />
              <Button variant="outline" onClick={() => toast.success("ABDM readiness settings saved locally")}>Save ABDM Settings</Button>
            </div>
            <div className="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="font-semibold text-navy-950 dark:text-white">Tally</h2>
              {["CSV", "Excel", "XML"].map((format) => <label key={format} className="mr-4 text-sm"><input name="tally" type="radio" defaultChecked={format === "CSV"} /> {format}</label>)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "appearance" ? (
        <Card>
          <CardContent className="space-y-5">
            <div>
              <h2 className="mb-3 font-semibold text-navy-950 dark:text-white">{t("settings.theme")}</h2>
              <div className="flex flex-wrap gap-2">
                {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
                  <Button key={mode} variant={theme === mode ? "primary" : "outline"} onClick={() => { setTheme(mode); applyTheme(mode); }}>
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-3 font-semibold text-navy-950 dark:text-white">{t("settings.language")}</h2>
              <div className="flex flex-wrap gap-2">
                {(["en", "hi", "mr", "ta"] as const).map((language) => (
                  <Button key={language} variant={i18n.language === language ? "primary" : "outline"} onClick={() => void changeLanguage(language)}>
                    {language.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Modal open={inviteOpen} title="Invite Team Member" onClose={() => setInviteOpen(false)}>
        <form className="grid gap-4" onSubmit={inviteForm.handleSubmit((values) => inviteStaff.mutate(values))}>
          <Input placeholder="Email" {...inviteForm.register("email", { required: true })} />
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950 dark:text-white" {...inviteForm.register("role")}>
            {["MANAGER", "BILLING", "DELIVERY"].map((role) => <option key={role}>{role}</option>)}
          </select>
          <Button type="submit" disabled={inviteStaff.isPending}>Send invite</Button>
        </form>
      </Modal>

      <Modal open={Boolean(revokeTarget)} title="Revoke Access" onClose={() => setRevokeTarget(null)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Revoke access for {revokeTarget?.user.email}?</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => revokeTarget && revokeStaff.mutate(revokeTarget.id)}>Revoke</Button>
        </div>
      </Modal>

      <Modal open={cancelOpen} title="Cancel Subscription" onClose={() => setCancelOpen(false)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Keep Growth and get the next 14 days to finish setup before downgrading, or cancel now.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep plan</Button>
          <Button variant="destructive" onClick={() => cancelSubscription.mutate()} disabled={cancelSubscription.isPending}>Cancel now</Button>
        </div>
      </Modal>
    </section>
  );
};
