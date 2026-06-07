import { MedicineCategory } from "@pharmacy-os/types";
import type { ApiResponse, Medicine, Pharmacy } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, ImagePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";

type Tab = "settings" | "catalogue" | "preview";
type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type OperatingHours = Record<DayKey, [string, string]>;

interface StoreSetting {
  enabled: boolean;
  bannerUrl: string | null;
  description: string;
  tagline: string;
  deliveryRadiusKm: number;
  minimumOrderValue: number;
  deliveryFee: number;
  operatingHours: OperatingHours;
}

interface StorefrontSettings extends Pharmacy {
  isOnlineEnabled: boolean;
  storeSetting: StoreSetting | null;
}

const dayLabels: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday"
};

const defaultHours: OperatingHours = {
  monday: ["09:00", "22:00"],
  tuesday: ["09:00", "22:00"],
  wednesday: ["09:00", "22:00"],
  thursday: ["09:00", "22:00"],
  friday: ["09:00", "22:00"],
  saturday: ["09:00", "22:00"],
  sunday: ["10:00", "20:00"]
};

const fetchInventory = async (): Promise<Medicine[]> => {
  const response = await api.get<ApiResponse<Medicine[]>>("/inventory", { params: { isOnline: "all", limit: 100, sort: "name" } });
  return response.data.data;
};

const rupeesToPaise = (value: string): number | null => {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 100) : null;
};

export const StorefrontPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [hours, setHours] = useState<OperatingHours>(defaultHours);
  const [radius, setRadius] = useState(5);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const settingsQuery = useQuery({
    queryKey: ["storefront-settings"],
    queryFn: () => unwrap<StorefrontSettings>(api.get("/settings/pharmacy"))
  });

  const inventoryQuery = useQuery({
    queryKey: ["storefront-catalogue"],
    queryFn: fetchInventory,
    placeholderData: []
  });

  const settings = settingsQuery.data;
  const storeSetting = settings?.storeSetting;
  const storeUrl = settings ? `${window.location.origin}/store/${settings.slug}` : "";

  useEffect(() => {
    if (!storeSetting) return;
    const settingsSync = window.setTimeout(() => {
      if (storeSetting.operatingHours) setHours(storeSetting.operatingHours);
      if (storeSetting.deliveryRadiusKm) setRadius(storeSetting.deliveryRadiusKm);
    }, 0);
    return () => window.clearTimeout(settingsSync);
  }, [storeSetting]);

  useEffect(() => {
    const priceSync = window.setTimeout(() => {
      const drafts = Object.fromEntries((inventoryQuery.data ?? []).map((medicine) => [medicine.id, String((medicine.onlinePrice ?? medicine.mrp) / 100)]));
      setPriceDrafts(drafts);
    }, 0);
    return () => window.clearTimeout(priceSync);
  }, [inventoryQuery.data]);

  const saveSettings = useMutation({
    mutationFn: (payload: Record<string, unknown>) => unwrap<StorefrontSettings>(api.put("/settings/pharmacy", payload)),
    onSuccess: async () => {
      toast.success("Store settings saved");
      await queryClient.invalidateQueries({ queryKey: ["storefront-settings"] });
    },
    onError: () => toast.error("Store settings could not be saved")
  });

  const uploadBanner = useMutation({
    mutationFn: async (file: File) => {
      const data = new FormData();
      data.append("file", file);
      return unwrap<{ url: string }>(api.post("/uploads/logo", data, { headers: { "Content-Type": "multipart/form-data" } }));
    },
    onSuccess: (response) => {
      saveSettings.mutate({ bannerUrl: response.url });
    },
    onError: () => toast.error("Banner upload failed")
  });

  const updateMedicine = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Medicine> }) => unwrap<Medicine>(api.put(`/inventory/${id}`, payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["storefront-catalogue"] });
    },
    onError: () => toast.error("Medicine could not be updated")
  });

  const selectedMedicines = useMemo(() => (inventoryQuery.data ?? []).filter((medicine) => selectedIds.has(medicine.id)), [inventoryQuery.data, selectedIds]);

  const bulkToggle = async (isOnline: boolean) => {
    await Promise.all(selectedMedicines.map((medicine) => updateMedicine.mutateAsync({ id: medicine.id, payload: { isOnline } })));
    toast.success(`${selectedMedicines.length} medicines updated`);
    setSelectedIds(new Set());
  };

  const updateHour = (day: DayKey, index: 0 | 1, value: string) => {
    setHours((current) => ({ ...current, [day]: index === 0 ? [value, current[day][1]] : [current[day][0], value] }));
  };

  const catalogue = inventoryQuery.data ?? [];
  const categories = Object.values(MedicineCategory);

  return (
    <section>
      <PageHeader
        title={t("modules.storefront")}
        actions={<Badge tone={settings?.isOnlineEnabled ? "teal" : "slate"}>{settings?.isOnlineEnabled ? "Live" : "Paused"}</Badge>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["settings", "catalogue", "preview"] as Tab[]).map((tab) => (
          <Button key={tab} variant={activeTab === tab ? "primary" : "outline"} onClick={() => setActiveTab(tab)}>
            {tab[0].toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {activeTab === "settings" ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardContent className="space-y-5">
              <label className="flex items-center justify-between rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                <span className="font-semibold text-navy-950 dark:text-white">Online store</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings?.isOnlineEnabled)}
                  onChange={(event) => saveSettings.mutate({ isOnlineEnabled: event.target.checked })}
                />
              </label>

              <div className="flex gap-2">
                <Input value={storeUrl} readOnly />
                <Button variant="outline" size="icon" onClick={() => void navigator.clipboard.writeText(storeUrl).then(() => toast.success("Copied"))}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(storeUrl, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadBanner.mutate(file);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file) uploadBanner.mutate(file);
                }}
                className="grid min-h-36 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-teal-300 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10"
              >
                <span className="inline-flex items-center gap-2 font-semibold text-navy-950 dark:text-white">
                  <ImagePlus className="h-5 w-5" /> Banner upload
                </span>
              </button>

              <Input
                placeholder="Store description"
                defaultValue={storeSetting?.description ?? ""}
                onBlur={(event) => saveSettings.mutate({ description: event.target.value })}
              />

              <div>
                <div className="mb-2 flex justify-between text-sm font-semibold text-navy-950 dark:text-white">
                  <span>Delivery radius</span>
                  <span>{radius} km</span>
                </div>
                <Input
                  type="range"
                  min={1}
                  max={25}
                  value={radius}
                  onChange={(event) => setRadius(Number(event.target.value))}
                  onMouseUp={() => saveSettings.mutate({ deliveryRadiusKm: radius })}
                  onTouchEnd={() => saveSettings.mutate({ deliveryRadiusKm: radius })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Minimum order value"
                  defaultValue={String((storeSetting?.minimumOrderValue ?? 20000) / 100)}
                  onBlur={(event) => saveSettings.mutate({ minimumOrderValue: rupeesToPaise(event.target.value) ?? 0 })}
                />
                <Input
                  placeholder="Delivery fee"
                  defaultValue={String((storeSetting?.deliveryFee ?? 3000) / 100)}
                  onBlur={(event) => saveSettings.mutate({ deliveryFee: rupeesToPaise(event.target.value) ?? 0 })}
                />
              </div>

              <div className="space-y-2">
                {Object.entries(dayLabels).map(([day, label]) => (
                  <div key={day} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                    <Input type="time" value={hours[day as DayKey][0]} onChange={(event) => updateHour(day as DayKey, 0, event.target.value)} onBlur={() => saveSettings.mutate({ operatingHours: hours })} />
                    <Input type="time" value={hours[day as DayKey][1]} onChange={(event) => updateHour(day as DayKey, 1, event.target.value)} onBlur={() => saveSettings.mutate({ operatingHours: hours })} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div
                className="min-h-56 rounded-md bg-navy-950 p-8 text-white"
                style={storeSetting?.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,22,40,.92), rgba(10,22,40,.45)), url(${storeSetting.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                <p className="font-display text-3xl font-bold">{settings?.name ?? "Pharmacy Store"}</p>
                <p className="mt-2 max-w-xl text-slate-200">{storeSetting?.description ?? "Trusted medicines, fast local delivery."}</p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {categories.slice(0, 6).map((category) => (
                  <div key={category} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-semibold text-navy-950 dark:text-white">{category.replaceAll("_", " ")}</p>
                    <p className="text-sm text-slate-500">Catalogue category</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "catalogue" ? (
        <Card>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setSelectedIds(new Set(catalogue.map((medicine) => medicine.id)))}>
                  Select all
                </Button>
                <Button variant="outline" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={selectedIds.size === 0} onClick={() => void bulkToggle(true)}>
                  <Check className="h-4 w-4" /> Enable
                </Button>
                <Button variant="outline" disabled={selectedIds.size === 0} onClick={() => void bulkToggle(false)}>
                  Disable
                </Button>
              </div>
            </div>

            <Table>
              <thead>
                <tr>
                  {["", "Medicine", "Category", "Stock", "Store", "Online price"].map((header) => <Th key={header}>{header}</Th>)}
                </tr>
              </thead>
              <tbody>
                {catalogue.map((medicine) => (
                  <tr key={medicine.id}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(medicine.id)}
                        onChange={(event) => {
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(medicine.id);
                            else next.delete(medicine.id);
                            return next;
                          });
                        }}
                      />
                    </Td>
                    <Td>
                      <p className="font-semibold text-navy-950 dark:text-white">{medicine.name}</p>
                      <p className="text-xs text-slate-500">{medicine.genericName}</p>
                    </Td>
                    <Td>{medicine.category}</Td>
                    <Td>{medicine.stockQty}</Td>
                    <Td>
                      <input
                        type="checkbox"
                        checked={medicine.isOnline}
                        onChange={(event) => updateMedicine.mutate({ id: medicine.id, payload: { isOnline: event.target.checked } })}
                      />
                    </Td>
                    <Td>
                      <div className="flex max-w-48 items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          step={0.01}
                          value={priceDrafts[medicine.id] ?? ""}
                          onChange={(event) => setPriceDrafts((current) => ({ ...current, [medicine.id]: event.target.value }))}
                          onBlur={(event) => updateMedicine.mutate({ id: medicine.id, payload: { onlinePrice: rupeesToPaise(event.target.value) } })}
                        />
                        <span className="text-xs text-slate-500">{formatCurrency(medicine.mrp)}</span>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "preview" ? (
        <Card>
          <CardContent>
            <iframe title="Storefront preview" src={settings ? `/store/${settings.slug}` : "about:blank"} className="h-[720px] w-full rounded-md border border-slate-200 bg-white dark:border-slate-800" />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
};
