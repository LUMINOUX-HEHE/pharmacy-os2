import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";

type EmptyStateVariant = "no-data" | "no-results" | "no-internet" | "error";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  variant?: EmptyStateVariant;
}

const illustrations: Record<EmptyStateVariant, ReactNode> = {
  "no-data": (
    <svg viewBox="0 0 120 90" className="h-20 w-28" role="img" aria-hidden="true">
      <rect x="22" y="18" width="76" height="54" rx="8" fill="#CCFBF1" />
      <path d="M36 36h48M36 48h34M36 60h22" stroke="#0F766E" strokeWidth="5" strokeLinecap="round" />
    </svg>
  ),
  "no-results": (
    <svg viewBox="0 0 120 90" className="h-20 w-28" role="img" aria-hidden="true">
      <circle cx="52" cy="40" r="22" fill="#E0F2FE" stroke="#2563EB" strokeWidth="6" />
      <path d="m68 56 18 18" stroke="#2563EB" strokeWidth="7" strokeLinecap="round" />
    </svg>
  ),
  "no-internet": (
    <svg viewBox="0 0 120 90" className="h-20 w-28" role="img" aria-hidden="true">
      <path d="M24 42c21-18 51-18 72 0M38 56c13-10 31-10 44 0M54 70h12" stroke="#D97706" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M30 76 90 16" stroke="#E11D48" strokeWidth="7" strokeLinecap="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 120 90" className="h-20 w-28" role="img" aria-hidden="true">
      <path d="M60 14 104 76H16L60 14Z" fill="#FFE4E6" stroke="#E11D48" strokeWidth="6" />
      <path d="M60 36v18M60 66h.1" stroke="#E11D48" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
};

export const EmptyState = ({ title, description, action, className, variant = "no-data" }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-10 text-center dark:border-slate-800", className)}>
    <div className="mb-4">{illustrations[variant]}</div>
    <h3 className="text-base font-semibold text-navy-950 dark:text-white">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);
