"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirmar",
  message,
  confirmLabel = "Excluir",
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} width="420px" title={title}>
      <div className={ui.form}>
        <p className="m-0 font-sans text-[0.9375rem] leading-normal text-ink">
          {message}
        </p>
        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="ghost" onClick={onClose} />
          <Button label={confirmLabel} variant="cancel" onClick={onConfirm} disabled={loading} />
        </div>
      </div>
    </Modal>
  );
}