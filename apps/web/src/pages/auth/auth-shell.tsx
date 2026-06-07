import { Store } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LanguageSwitcher } from "../../components/layout/language-switcher";


export const AuthShell = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[0.95fr_1.05fr] dark:bg-slate-950">
      <aside className="mesh-bg hidden flex-col justify-between p-10 lg:flex dark:text-white">
        <Link to="/" className="flex items-center gap-3 font-display text-2xl font-bold text-navy-950 dark:text-white">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-navy-950 text-teal-400">
            <Store className="h-6 w-6" />
          </span>
          {t("common.appName")}
        </Link>
        <div>
          <p className="max-w-lg font-display text-5xl font-bold leading-tight text-slate-900 dark:text-white">{t("landing.hero")}</p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {["₹48K", "122", "18"].map((stat) => (
              <div key={stat} className="rounded-lg bg-white/80 p-4 shadow-soft backdrop-blur dark:bg-slate-900/80">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live metric</p>
              </div>
            ))}
          </div>
        </div>
        <blockquote className="max-w-md text-slate-600 dark:text-slate-400">“Our billing queue dropped by half in the first week.”</blockquote>
      </aside>
      <main className="flex items-center justify-center p-4">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
};
