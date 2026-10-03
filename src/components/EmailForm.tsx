"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

interface EmailFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (endereco: string, principal: boolean) => void;
  initialEndereco?: string;
  initialPrincipal?: boolean;
  editing?: boolean;
}

const inputStyle = {
  height: 40, padding: "0 16px", border: "1px solid #d9d9d9",
  borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
  outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" as const,
};

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
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>E-mail</label>
          <input
            autoFocus
            value={endereco}
            onChange={(e) => { setEndereco(e.target.value); setErro(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder="nome@dominio.com"
            style={{ ...inputStyle, borderColor: erro ? "#ff383c" : "#d9d9d9" }}
          />
          {erro && <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#ff383c" }}>{erro}</span>}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e", cursor: "pointer" }}>
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} style={{ accentColor: "#1b9956", width: 18, height: 18 }} />
          E-mail principal
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: "4px" }}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label={editing ? "Atualizar" : "Adicionar"} variant="primary" onClick={handleConfirm} disabled={!endereco.trim()} />
        </div>
      </div>
    </Modal>
  );
}
