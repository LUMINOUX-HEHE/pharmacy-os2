import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "../lib/cn.js";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  variant?: "text" | "rect" | "circle";
}

export const Skeleton = ({ className, width, height, variant = "rect", style, ...props }: SkeletonProps) => (
  <div
    className={cn(
      "animate-shimmer bg-slate-100 dark:bg-slate-800",
      variant === "circle" ? "rounded-full" : variant === "text" ? "h-4 rounded" : "rounded-md",
      className
    )}
    style={{ width, height, ...style }}
    {...props}
  />
);
