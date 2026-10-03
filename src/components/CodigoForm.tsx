"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { validarCodigo } from "@/lib/codigo";

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
  const [erro, setErro] = useState("");

  const ehEan = tipo === "EAN12" || tipo === "EAN13";
  const maxLength = tipo === "EAN12" ? 12 : tipo === "EAN13" ? 13 : undefined;

  function handleConfirm() {
    const res = validarCodigo(tipo, valor);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    onConfirm(tipo, res.valor);
    setValor("");
    setTipo(padrao);
    setErro("");
  }

  function handleClose() {
    setValor("");
    setTipo(padrao);
    setErro("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} width="480px">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>
            Tipo de código
          </label>
          <select
            value={tipo}
            onChange={(e) => { setTipo(e.target.value); setErro(""); }}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9",
              borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
              outline: "none", background: "#fff",
            }}
          >
            {tiposCodigo.map((t) => (
              <option key={t.id_tipo_codigo} value={t.nome}>{t.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>
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
              setErro("");
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder={ehEan ? `${maxLength} dígitos` : "Valor do código"}
            style={{
              height: 40, padding: "0 16px", border: `1px solid ${erro ? "#ff383c" : "#d9d9d9"}`,
              borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
              outline: "none",
            }}
          />
          {erro && (
            <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#ff383c" }}>
              {erro}
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "4px" }}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label={editing ? "Atualizar" : "Adicionar"} variant="primary" onClick={handleConfirm} disabled={!valor.trim()} />
        </div>
      </div>
    </Modal>
  );
}
