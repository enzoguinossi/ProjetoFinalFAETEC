"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

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
  initialTipo = "DIGITACAO",
  initialValor = "",
  editing,
}: CodigoFormProps) {
  const [tipo, setTipo] = useState(initialTipo);
  const [valor, setValor] = useState(initialValor);

  function handleConfirm() {
    if (!valor.trim()) return;
    onConfirm(tipo, valor.trim());
    setValor("");
    setTipo("DIGITACAO");
  }

  function handleClose() {
    setValor("");
    setTipo("DIGITACAO");
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
            onChange={(e) => setTipo(e.target.value)}
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
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
            placeholder="Valor do código"
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9",
              borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "4px" }}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label={editing ? "Atualizar" : "Adicionar"} variant="primary" onClick={handleConfirm} disabled={!valor.trim()} />
        </div>
      </div>
    </Modal>
  );
}