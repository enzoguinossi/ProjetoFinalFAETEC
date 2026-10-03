"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { TIPO_TELEFONE, type TipoTelefone } from "@/types";

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

const inputStyle = {
  height: 40, padding: "0 16px", border: "1px solid #d9d9d9",
  borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
  outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" as const,
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
  const [numero, setNumero] = useState(initialNumero);
  const [tipo, setTipo] = useState<TipoTelefone>(initialTipo);
  const [principal, setPrincipal] = useState(initialPrincipal);
  const [erro, setErro] = useState("");

  function handleConfirm() {
    const v = numero.trim();
    if (!v) {
      setErro("Informe o número.");
      return;
    }
    onConfirm(v, tipo, principal);
    setNumero("");
    setTipo("CELULAR");
    setPrincipal(false);
    setErro("");
  }

  function handleClose() {
    setNumero("");
    setTipo("CELULAR");
    setPrincipal(false);
    setErro("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} width="440px">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Número</label>
          <input
            autoFocus
            value={numero}
            onChange={(e) => { setNumero(e.target.value); setErro(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder="(21) 99999-9999"
            style={{ ...inputStyle, borderColor: erro ? "#ff383c" : "#d9d9d9" }}
          />
          {erro && <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#ff383c" }}>{erro}</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTelefone)} style={inputStyle}>
            {TIPO_TELEFONE.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e", cursor: "pointer" }}>
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} style={{ accentColor: "#1b9956", width: 18, height: 18 }} />
          Telefone principal
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: "4px" }}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label={editing ? "Atualizar" : "Adicionar"} variant="primary" onClick={handleConfirm} disabled={!numero.trim()} />
        </div>
      </div>
    </Modal>
  );
}
