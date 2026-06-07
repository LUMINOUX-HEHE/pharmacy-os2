import { Button } from "./button.js";
import { Modal } from "./modal.js";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const confirmVariant = {
  danger: "destructive",
  warning: "secondary",
  info: "primary"
} as const;

export const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "info",
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) => (
  <Modal open={open} title={title} onClose={onCancel}>
    <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
      <Button variant={confirmVariant[variant]} onClick={onConfirm} disabled={isLoading}>{confirmLabel}</Button>
    </div>
  </Modal>
);
