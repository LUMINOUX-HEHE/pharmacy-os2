import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}

export const PageHeader = ({ title, breadcrumb, actions }: PageHeaderProps) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      {breadcrumb ? <div className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">{breadcrumb}</div> : null}
      <h1 className="font-display text-3xl font-bold tracking-normal text-navy-950 dark:text-white">{title}</h1>
    </div>
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </div>
);
