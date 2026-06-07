import { ArrowRight, Store } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LanguageSwitcher } from "../../components/layout/language-switcher";


export const PublicLayout = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white text-navy-950 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-950 text-teal-400">
              <Store className="h-5 w-5" />
            </span>
            {t("common.appName")}
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300">
            <Link to="/features">Features</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/contact">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/auth/login" className="hidden text-sm font-semibold text-slate-600 sm:inline">
              Login
            </Link>
            <Link
              to="/auth/signup"
              className="hidden h-10 items-center justify-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-semibold text-navy-950 shadow-glow-teal transition hover:bg-teal-400 sm:inline-flex"
            >
              {t("common.startTrial")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-100 bg-navy-950 text-white dark:border-slate-800">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
          {[
            ["Product", ["Features", "Pricing", "Storefront", "Billing POS"]],
            ["Company", ["Contact", "Careers", "Partners", "Security"]],
            ["Resources", ["API docs", "Help center", "Privacy Policy", "Terms of Service"]],
            ["Contact", ["support@pharmacyos.in", "+91 22 4000 9000", "Mumbai, India", "Made in India"]]
          ].map(([group, links]) => (
            <div key={group as string}>
              <h3 className="font-semibold">{group as string}</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {(links as string[]).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
};
