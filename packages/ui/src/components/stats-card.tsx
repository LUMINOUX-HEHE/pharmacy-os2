import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";

export interface StatsCardProps {
  value: ReactNode;
  label: ReactNode;
  trend?: number;
  sparkline?: ReactNode;
  className?: string;
}

export const StatsCard = ({ value, label, trend, sparkline, className }: StatsCardProps) => {
  const positive = (trend ?? 0) >= 0;
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-950", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-navy-950 dark:text-white">{value}</p>
        </div>
        {trend !== undefined ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", positive ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300")}>
            {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </span>
        ) : null}
      </div>
      {sparkline ? <div className="mt-4 h-10">{sparkline}</div> : null}
    </div>
  );
};
