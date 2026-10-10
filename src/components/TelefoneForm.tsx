"use client";

import { useState } from "react";
import ContatoFormModal from "@/components/ContatoFormModal";
import { TIPO_TELEFONE, type TipoTelefone } from "@/types";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";
import {
  formatarTelefone,
  validarTelefone,
  TELEFONE_MAX_CARACTERES,
  TIPO_TELEFONE_LABEL,
} from "@/lib/telefone";

interface TelefoneFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (numero: string, tipo: TipoTelefone, principal: boolean) => void;
  initialNumero?: string;
  initialTipo?: TipoTelefone;
  initialPrincipal?: boolean;
  editing?: boolean;
}

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
  const mostrarAviso = useAviso();

  function handleConfirm(principal: boolean) {
    const res = validarTelefone(numero);
    if (!res.ok) {
      mostrarAviso(res.erro, "erro");
      return;
    }
    onConfirm(res.numero, tipo, principal);
    setNumero("");
    setTipo("CELULAR");
  }

  return (
    <ContatoFormModal
      open={open}
      onClose={onClose}
      principalLabel="Telefone principal"
      confirmLabel={editing ? "Atualizar" : "Adicionar"}
      podeConfirmar={numero.trim().length > 0}
      onConfirm={handleConfirm}
      initialPrincipal={initialPrincipal}
    >
      <div className={ui.field}>
        <label className={ui.label}>Número</label>
        <input
          autoFocus
          value={numero}
          inputMode="tel"
          maxLength={TELEFONE_MAX_CARACTERES}
          onChange={(e) => setNumero(formatarTelefone(e.target.value))}
          placeholder="(00) 00000-0000"
          className={ui.input}
        />
      </div>

      <div className={ui.field}>
        <label className={ui.label}>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTelefone)} className={ui.select}>
          {TIPO_TELEFONE.map((t) => <option key={t} value={t}>{TIPO_TELEFONE_LABEL[t]}</option>)}
        </select>
      </div>
    </ContatoFormModal>
  );
}
