"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";

interface ContatoFormModalProps {
  open: boolean;
  onClose: () => void;
  principalLabel: string;
  confirmLabel: string;
  podeConfirmar: boolean;
  onConfirm: (principal: boolean) => void;
  initialPrincipal?: boolean;
  children: React.ReactNode;
}

export default function ContatoFormModal({
  open,
  onClose,
  principalLabel,
  confirmLabel,
  podeConfirmar,
  onConfirm,
  initialPrincipal = false,
  children,
}: ContatoFormModalProps) {
  const [principal, setPrincipal] = useState(initialPrincipal);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "SELECT" || alvo.tagName === "TEXTAREA") return;
    e.preventDefault();
    if (podeConfirmar) onConfirm(principal);
  }

  return (
    <Modal open={open} onClose={onClose} width="440px">
      <div className={ui.form} onKeyDown={handleKeyDown}>
        {children}

        <label className="flex cursor-pointer items-center gap-2 font-sans text-base text-ink-strong">
          <input
            type="checkbox"
            checked={principal}
            onChange={(e) => setPrincipal(e.target.checked)}
            className="h-[18px] w-[18px] accent-brand"
          />
          {principalLabel}
        </label>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="cancel" onClick={onClose} />
          <Button
            label={confirmLabel}
            variant="primary"
            onClick={() => onConfirm(principal)}
            disabled={!podeConfirmar}
          />
        </div>
      </div>
    </Modal>
  );
}
