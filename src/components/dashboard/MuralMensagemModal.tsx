"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import {
  atualizarMensagemMural,
  criarMensagemMural,
  type MuralMensagemDTO,
} from "@/app/dashboard/actions";

type Props = {
  open: boolean;
  onClose: () => void;
  mensagem: MuralMensagemDTO | null;
};

const inputCls = `${ui.input} px-3`;

export default function MuralMensagemModal({ open, onClose, mensagem }: Props) {
  const router = useRouter();
  const aviso = useAviso();
  const [titulo, setTitulo] = useState(mensagem?.titulo ?? "");
  const [conteudo, setConteudo] = useState(mensagem?.conteudo ?? "");
  const [expiracao, setExpiracao] = useState(
    mensagem?.data_expiracao?.slice(0, 10) ?? "",
  );
  const [salvando, iniciarSalvamento] = useTransition();

  function salvar() {
    iniciarSalvamento(async () => {
      const form = {
        titulo,
        conteudo,
        data_expiracao: expiracao || null,
      };
      const resultado = mensagem
        ? await atualizarMensagemMural(mensagem.id, form)
        : await criarMensagemMural(form);

      if ("error" in resultado) {
        aviso(resultado.error, "erro");
        return;
      }

      aviso(mensagem ? "Mensagem alterada." : "Mensagem publicada.");
      window.dispatchEvent(new Event("mural:atualizado"));
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mensagem ? "Editar mensagem" : "Nova mensagem"}
    >
      <div className={ui.form} data-figma="MuralMensagemModal">
        <label className={ui.field}>
          <span className={ui.label}>Título (opcional)</span>
          <input
            className={inputCls}
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            maxLength={120}
            placeholder="Ex.: Aviso da coordenação"
          />
        </label>

        <label className={ui.field}>
          <span className={ui.label}>Mensagem</span>
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-border-input px-3 py-2 font-sans text-base outline-none"
            value={conteudo}
            onChange={(evento) => setConteudo(evento.target.value)}
            placeholder="Escreva o conteúdo da mensagem..."
            required
          />
        </label>

        <label className={ui.field}>
          <span className={ui.label}>Expira em (opcional)</span>
          <input
            type="date"
            className={inputCls}
            value={expiracao}
            onChange={(evento) => setExpiracao(evento.target.value)}
          />
          <span className="text-[0.6875rem] text-[#8a8f9a]">
            A mensagem fica ativa até o fim do dia escolhido; depois disso, vai para
            “Ver anteriores”.
          </span>
        </label>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="ghost" onClick={onClose} />
          <Button
            label={mensagem ? "Salvar" : "Publicar"}
            onClick={salvar}
            disabled={salvando}
          />
        </div>
      </div>
    </Modal>
  );
}
