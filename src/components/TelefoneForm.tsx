"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { TIPO_TELEFONE, type TipoTelefone } from "@/types";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";
import { formatarTelefone, validarTelefone, TELEFONE_MAX_CARACTERES } from "@/lib/telefone";

interface TelefoneFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (numero: string, tipo: TipoTelefone, principal: boolean) => void;
  initialNumero?: string;
  initialTipo?: TipoTelefone;
  initialPrincipal?: boolean;
  editing?: boolean;
}

const TIPO_LABEL: Record<TipoTelefone, string> = {
  CELULAR: "Celular",
  FIXO: "Fixo",
  COMERCIAL: "Comercial",
};

export default function TelefoneForm({
  open,
  onClose,
  onConfirm,
  initialNumero = "",
  initialTipo = "CELULAR",
  initialPrincipal = false,
  editing,
}: TelefoneFormProps) {
  const [numero, setNumero] = useState(formatarTelefone(initialNumero));
  const [tipo, setTipo] = useState<TipoTelefone>(initialTipo);
  const [principal, setPrincipal] = useState(initialPrincipal);
  const mostrarAviso = useAviso();

  function handleConfirm() {
    const res = validarTelefone(numero);
    if (!res.ok) {
      mostrarAviso(res.erro, "erro");
      return;
    }
    onConfirm(res.numero, tipo, principal);
    setNumero("");
    setTipo("CELULAR");
    setPrincipal(false);
  }

  function handleClose() {
    setNumero("");
    setTipo("CELULAR");
    setPrincipal(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} width="440px">
      <div className={ui.form}>
        <div className={ui.field}>
          <label className={ui.label}>Número</label>
          <input
            autoFocus
            value={numero}
            inputMode="tel"
            maxLength={TELEFONE_MAX_CARACTERES}
            onChange={(e) => setNumero(formatarTelefone(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder="(00) 00000-0000"
            className={ui.input}
          />
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTelefone)} className={ui.select}>
            {TIPO_TELEFONE.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-2 font-sans text-base text-ink-strong">
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} className="h-[18px] w-[18px] accent-brand" />
          Telefone principal
        </label>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label={editing ? "Atualizar" : "Adicionar"} variant="primary" onClick={handleConfirm} disabled={!numero.trim()} />
        </div>
      </div>
    </Modal>
  );
}
