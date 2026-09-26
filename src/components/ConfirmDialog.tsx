"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

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
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <p style={{ fontFamily: "Inter,sans-serif", fontSize: "0.9375rem", color: "#21272a", lineHeight: "1.5", margin: 0 }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "4px" }}>
          <Button label="Cancelar" variant="ghost" onClick={onClose} />
          <Button label={confirmLabel} variant="cancel" onClick={onConfirm} disabled={loading} />
        </div>
      </div>
    </Modal>
  );
}