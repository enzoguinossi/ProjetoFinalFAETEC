"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";

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
      <div className="flex flex-col gap-4">
        <div className={ui.field}>
          <label className={ui.label}>Perfil</label>
          <select
            value={idPerfil}
            onChange={(e) => { setIdPerfil(e.target.value ? Number(e.target.value) : ""); setErro(""); }}
            className={ui.select}
          >
            <option value="">Selecione...</option>
            {perfis.map((p) => (
              <option key={p.id_perfil} value={p.id_perfil}>{p.nome}</option>
            ))}
          </select>
          {selecionado?.descricao && (
            <span className="font-sans text-[0.8125rem] text-[#616161]">
              {selecionado.descricao}
            </span>
          )}
          {erro && <span className="font-sans text-[0.8125rem] text-cancel">{erro}</span>}
        </div>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="cancel" onClick={handleClose} />
          <Button label="Aplicar" variant="primary" onClick={handleConfirm} disabled={idPerfil === ""} />
        </div>
      </div>
    </Modal>
  );
}
