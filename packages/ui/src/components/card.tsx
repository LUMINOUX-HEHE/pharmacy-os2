import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn.js";


export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950", className)}
    {...props}
  />
));
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("border-b border-slate-100 p-5 dark:border-slate-800", className)} {...props} />
);

export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5", className)} {...props} />
);
