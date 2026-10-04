"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { validarCodigo } from "@/lib/codigo";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

interface TipoCodigo {
  id_tipo_codigo: number;
  nome: string;
}

interface CodigoFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (tipo: string, valor: string) => void;
  tiposCodigo: TipoCodigo[];
  initialTipo?: string;
  initialValor?: string;
  editing?: boolean;
}

export default function CodigoForm({
  open,
  onClose,
  onConfirm,
  tiposCodigo,
  initialTipo,
  initialValor = "",
  editing,
}: CodigoFormProps) {
  const padrao = tiposCodigo.some((t) => t.nome === "DIGITACAO")
    ? "DIGITACAO"
    : (tiposCodigo[0]?.nome ?? "");

  const [tipo, setTipo] = useState(initialTipo ?? padrao);
  const [valor, setValor] = useState(initialValor);
  const mostrarAviso = useAviso();

  const ehEan = tipo === "EAN12" || tipo === "EAN13";
  const maxLength = tipo === "EAN12" ? 12 : tipo === "EAN13" ? 13 : undefined;

  function handleConfirm() {
    const res = validarCodigo(tipo, valor);
    if (!res.ok) {
      mostrarAviso(res.erro, "erro");
      return;
    }
    onConfirm(tipo, res.valor);
    setValor("");
    setTipo(padrao);
  }

  function handleClose() {
    setValor("");
    setTipo(padrao);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} width="480px">
      <div className={ui.form}>
        <div className={ui.field}>
          <label className={ui.label}>
            Tipo de código
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={ui.select}
          >
            {tiposCodigo.map((t) => (
              <option key={t.id_tipo_codigo} value={t.nome}>{t.nome}</option>
            ))}
          </select>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>
            Código
          </label>
          <input
            autoFocus
            value={valor}
            inputMode={ehEan ? "numeric" : "text"}
            maxLength={maxLength}
            onChange={(e) => {
              const v = ehEan ? e.target.value.replace(/\D/g, "") : e.target.value;
              setValor(v);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder={ehEan ? `${maxLength} dígitos` : "Valor do código"}
            className={ui.input}
          />
        </div>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label={editing ? "Atualizar" : "Adicionar"} variant="primary" onClick={handleConfirm} disabled={!valor.trim()} />
        </div>
      </div>
    </Modal>
  );
}
