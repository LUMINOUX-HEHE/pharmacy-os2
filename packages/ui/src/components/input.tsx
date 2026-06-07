import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "../lib/cn.js";


export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-navy-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
