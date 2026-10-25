"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { listarMensagensAnteriores, type MuralMensagemDTO } from "@/app/dashboard/actions";
import { formatarDataHora } from "./formatar";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MuralHistoricoModal({ open, onClose }: Props) {
  const [mensagens, setMensagens] = useState<MuralMensagemDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    listarMensagensAnteriores()
      .then((lista) => {
        if (ativo) setMensagens(lista);
      })
      .catch(() => {
        if (ativo) setErro("Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="Mensagens anteriores">
      <div className="flex flex-col gap-3" data-figma="MuralHistoricoModal">
        <p className="m-0 text-xs text-[#8a8f9a]">
          Histórico auditável: mensagens manuais desativadas ou expiradas e alertas
          automáticos de validades anteriores.
        </p>

        {carregando && (
          <p className="m-0 py-4 text-center text-xs text-[#8a8f9a]">Carregando...</p>
        )}
        {erro && <p className="m-0 text-sm text-danger">{erro}</p>}

        {!carregando && !erro && mensagens.length === 0 && (
          <p className="m-0 py-4 text-center text-xs text-[#8a8f9a]">
            Nenhuma mensagem anterior.
          </p>
        )}

        {!carregando && mensagens.length > 0 && (
          <ul className="m-0 flex max-h-[55vh] list-none flex-col gap-2 overflow-y-auto p-0">
            {mensagens.map((mensagem) => (
              <li
                key={mensagem.id}
                className="rounded-lg border border-border bg-[#f2f4f8] px-[0.875rem] py-[0.625rem]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {mensagem.titulo && (
                    <strong className="text-xs text-ink-strong">{mensagem.titulo}</strong>
                  )}
                  {mensagem.automatica && (
                    <span className="rounded-full bg-[#e8f0fe] px-2 py-px text-[0.625rem] font-semibold text-[#1a73e8]">
                      Sistema
                    </span>
                  )}
                </div>
                <p className="m-0 mt-1 whitespace-pre-wrap text-xs text-ink">
                  {mensagem.conteudo}
                </p>
                <div className="mt-1 text-[0.625rem] text-[#8a8f9a]">
                  {mensagem.autor} · {formatarDataHora(mensagem.data_publicacao)}
                  {mensagem.data_expiracao
                    ? ` · expirou em ${formatarDataHora(mensagem.data_expiracao)}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
