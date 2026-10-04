"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";

interface EmailFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (endereco: string, principal: boolean) => void;
  initialEndereco?: string;
  initialPrincipal?: boolean;
  editing?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [erro, setErro] = useState("");

  function handleConfirm() {
    const v = endereco.trim();
    if (!EMAIL_RE.test(v)) {
      setErro("Informe um e-mail válido.");
      return;
    }
    onConfirm(v, principal);
    setEndereco("");
    setPrincipal(false);
    setErro("");
  }

  function handleClose() {
    setEndereco("");
    setPrincipal(false);
    setErro("");
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
            onChange={(e) => { setEndereco(e.target.value); setErro(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder="nome@dominio.com"
            className={`${ui.input} ${erro ? "border-cancel" : ""}`}
          />
          {erro && <span className="font-sans text-[0.8125rem] text-cancel">{erro}</span>}
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
