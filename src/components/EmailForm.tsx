"use client";

import { useState } from "react";
import ContatoFormModal from "@/components/ContatoFormModal";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";
import { validarEmail } from "@/lib/email";

interface EmailFormProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (endereco: string, principal: boolean) => void;
  initialEndereco?: string;
  initialPrincipal?: boolean;
  editing?: boolean;
}

export default function EmailForm({
  open,
  onClose,
  onConfirm,
  initialEndereco = "",
  initialPrincipal = false,
  editing,
}: EmailFormProps) {
  const [endereco, setEndereco] = useState(initialEndereco);
  const mostrarAviso = useAviso();

  function handleConfirm(principal: boolean) {
    const res = validarEmail(endereco);
    if (!res.ok) {
      mostrarAviso(res.erro, "erro");
      return;
    }
    onConfirm(res.endereco, principal);
    setEndereco("");
  }

  return (
    <ContatoFormModal
      open={open}
      onClose={onClose}
      principalLabel="E-mail principal"
      confirmLabel={editing ? "Atualizar" : "Adicionar"}
      podeConfirmar={endereco.trim().length > 0}
      onConfirm={handleConfirm}
      initialPrincipal={initialPrincipal}
    >
      <div className={ui.field}>
        <label className={ui.label}>E-mail</label>
        <input
          autoFocus
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="nome@dominio.com"
          className={ui.input}
        />
      </div>
    </ContatoFormModal>
  );
}
