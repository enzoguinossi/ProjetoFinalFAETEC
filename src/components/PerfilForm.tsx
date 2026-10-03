"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

interface PerfilOption {
  id_perfil: number;
  nome: string;
  descricao: string | null;
}

interface PerfilFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (id_perfil: number) => void;
  perfis: PerfilOption[];
}

const inputStyle = {
  height: 40, padding: "0 16px", border: "1px solid #d9d9d9",
  borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
  outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" as const,
};

export default function PerfilForm({ open, onClose, onConfirm, perfis }: PerfilFormProps) {
  const [idPerfil, setIdPerfil] = useState<number | "">("");
  const [erro, setErro] = useState("");

  function handleConfirm() {
    if (idPerfil === "") {
      setErro("Selecione um perfil.");
      return;
    }
    onConfirm(Number(idPerfil));
    setIdPerfil("");
    setErro("");
  }

  function handleClose() {
    setIdPerfil("");
    setErro("");
    onClose();
  }

  const selecionado = perfis.find((p) => p.id_perfil === idPerfil);

  return (
    <Modal open={open} onClose={handleClose} width="440px">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Perfil</label>
          <select
            value={idPerfil}
            onChange={(e) => { setIdPerfil(e.target.value ? Number(e.target.value) : ""); setErro(""); }}
            style={inputStyle}
          >
            <option value="">Selecione...</option>
            {perfis.map((p) => (
              <option key={p.id_perfil} value={p.id_perfil}>{p.nome}</option>
            ))}
          </select>
          {selecionado?.descricao && (
            <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#616161" }}>
              {selecionado.descricao}
            </span>
          )}
          {erro && <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#ff383c" }}>{erro}</span>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: "4px" }}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label="Aplicar" variant="primary" onClick={handleConfirm} disabled={idPerfil === ""} />
        </div>
      </div>
    </Modal>
  );
}
