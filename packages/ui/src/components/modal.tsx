import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";

import { Button } from "./button.js";


export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export const Modal = ({ open, title, children, onClose }: ModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className={cn("max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-hard dark:bg-slate-950")}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
