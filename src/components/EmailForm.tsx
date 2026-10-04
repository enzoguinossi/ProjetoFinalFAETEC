"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";
import { validarEmail } from "@/lib/email";

interface EmailFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (endereco: string, principal: boolean) => void;
  initialEndereco?: string;
  initialPrincipal?: boolean;
  editing?: boolean;
}

export default function EmailForm({
  open,
  onClose,
  onConfirm,
  initialEndereco = "",
  initialPrincipal = false,
  editing,
}: EmailFormProps) {
  const [endereco, setEndereco] = useState(initialEndereco);
  const [principal, setPrincipal] = useState(initialPrincipal);
  const mostrarAviso = useAviso();

  function handleConfirm() {
    const res = validarEmail(endereco);
    if (!res.ok) {
      mostrarAviso(res.erro, "erro");
      return;
    }
    onConfirm(res.endereco, principal);
    setEndereco("");
    setPrincipal(false);
  }

  function handleClose() {
    setEndereco("");
    setPrincipal(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} width="440px">
      <div className={ui.form}>
        <div className={ui.field}>
          <label className={ui.label}>E-mail</label>
          <input
            autoFocus
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder="nome@dominio.com"
            className={ui.input}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 font-sans text-base text-ink-strong">
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} className="h-[18px] w-[18px] accent-brand" />
          E-mail principal
        </label>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label={editing ? "Atualizar" : "Adicionar"} variant="primary" onClick={handleConfirm} disabled={!endereco.trim()} />
        </div>
      </div>
    </Modal>
  );
}
