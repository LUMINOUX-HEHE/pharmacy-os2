import type { Order } from "@pharmacy-os/types";
import { Badge, Button, cn } from "@pharmacy-os/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Menu, Moon, Search, Store, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";


import { useAuthStore } from "../../features/auth/auth-store";
import { createPharmacySocket } from "../../lib/socket";
import { applyTheme } from "../../lib/theme-mode";

import { LanguageSwitcher } from "./language-switcher";

const navItems = [
  ["dashboard", "/dashboard", "dashboard:read"],
  ["inventory", "/inventory", "inventory:read"],
  ["billing", "/billing", "billing:read"],
  ["orders", "/orders", "orders:read"],
  ["storefront", "/storefront", "orders:read"],
  ["customers", "/customers", "customers:read"],
  ["analytics", "/analytics", "analytics:read"],
  ["distributors", "/distributors", "inventory:read"],
  ["delivery", "/delivery", "delivery:read"],
  ["settings", "/settings", "settings:read"],
  ["staff", "/staff", "billing:write"]
] as const;

export const AppShell = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const [notificationCount, setNotificationCount] = useState(0);
  const logout = useAuthStore((state) => state.logout);
  const pharmacy = useAuthStore((state) => state.pharmacy);
  const permissions = useAuthStore((state) => state.permissions);
  const navigate = useNavigate();
  const visibleNavItems = navItems.filter(([, , permission]) => permissions.includes(permission));

  const toggleTheme = () => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    setDark(next === "dark");
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
      oscillator.addEventListener("ended", () => void audioContext.close());
    } catch {
      // Browsers can block audio until user interaction; the toast still carries the event.
    }
  };

  useEffect(() => {
    if (!pharmacy?.id) return;
    const socket = createPharmacySocket(pharmacy.id);

    socket.on("order:new", (payload: { orderId: string; order?: Order }) => {
      toast.success("New online order received");
      playNotificationSound();
      const newOrder = payload.order;
      if (newOrder) {
        queryClient.setQueryData<Order[]>(["orders"], (orders = []) => {
          if (orders.some((order) => order.id === newOrder.id)) return orders;
          return [newOrder, ...orders];
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    });

    socket.on("stock:low_alert", (payload: { name?: string; stockQty?: number }) => {
      setNotificationCount((count) => count + 1);
      toast.warning(`${payload.name ?? "Medicine"} is below reorder level`);
    });

    socket.on("order:status_update", (payload: { orderId: string; status: Order["status"] }) => {
      queryClient.setQueryData<Order[]>(["orders"], (orders = []) =>
        orders.map((order) => (order.id === payload.orderId ? { ...order, status: payload.status } : order))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [pharmacy?.id, queryClient]);

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <Link to="/dashboard" className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-navy-950 text-teal-400">
          <Store className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-display text-lg font-bold text-navy-950 dark:text-white">{t("common.appName")}</span>
          <span className="text-xs text-slate-500">{pharmacy?.name ?? "Sharma Medical Store"}</span>
        </span>
      </Link>
      <div className="px-5">
        <Badge tone="teal">Growth Plan</Badge>
      </div>
      <nav className="mt-5 flex-1 space-y-1 px-3">
        {visibleNavItems.map(([key, href]) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-navy-950 dark:text-slate-300 dark:hover:bg-slate-900",
                isActive && "bg-navy-950 text-white hover:bg-navy-950 hover:text-white"
              )
            }
            onClick={() => { setOpen(false); }}
          >
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            logout();
            navigate("/auth/login");
          }}
        >
          {t("nav.logout")}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-navy-950 dark:bg-slate-950 dark:text-white">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex">{sidebar}</div>
      {open ? <div className="fixed inset-0 z-40 bg-navy-950/50 lg:hidden" onClick={() => { setOpen(false); }} /> : null}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform transition lg:hidden",
          open ? "translate-x-0" : "invisible pointer-events-none -translate-x-full"
        )}
        aria-hidden={!open}
      >
        {sidebar}
      </div>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => { setOpen(true); }} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-teal-400 dark:border-slate-800 dark:bg-slate-900"
              placeholder={t("common.search")}
            />
          </div>
          <LanguageSwitcher />
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 ? (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-100 font-bold text-teal-700">SM</div>
        </header>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
