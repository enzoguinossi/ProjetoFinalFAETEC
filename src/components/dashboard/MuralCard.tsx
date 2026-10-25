"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import {
  desativarMensagemMural,
  type MuralMensagemDTO,
} from "@/app/dashboard/actions";
import MuralMensagemModal from "./MuralMensagemModal";
import MuralHistoricoModal from "./MuralHistoricoModal";
import { formatarData, formatarDataHora } from "./formatar";

type Props = {
  mensagens: MuralMensagemDTO[];
  /** ISO da última leitura do mural por este usuário. */
  vistoEm: string | null;
  podeCriar: boolean;
  podeAlterar: boolean;
  podeExcluir: boolean;
};

const acaoBtnCls =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-[#5f6b7a] cursor-pointer transition-colors hover:bg-white";

export default function MuralCard({
  mensagens,
  vistoEm,
  podeCriar,
  podeAlterar,
  podeExcluir,
}: Props) {
  const router = useRouter();
  const aviso = useAviso();
  const [modalAberto, setModalAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<MuralMensagemDTO | null>(null);
  const [versaoModal, setVersaoModal] = useState(0);
  const [confirmando, setConfirmando] = useState<MuralMensagemDTO | null>(null);
  const [desativando, iniciarDesativacao] = useTransition();

  const vistoEmMs = vistoEm ? new Date(vistoEm).getTime() : null;

  function abrirNova() {
    setEmEdicao(null);
    setVersaoModal((versao) => versao + 1);
    setModalAberto(true);
  }

  function abrirEdicao(mensagem: MuralMensagemDTO) {
    setEmEdicao(mensagem);
    setVersaoModal((versao) => versao + 1);
    setModalAberto(true);
  }

  function confirmarDesativacao() {
    const mensagem = confirmando;
    if (!mensagem) return;
    iniciarDesativacao(async () => {
      const resultado = await desativarMensagemMural(mensagem.id);
      if ("error" in resultado) {
        aviso(resultado.error, "erro");
        return;
      }
      aviso("Mensagem desativada. Ela continua em “Ver anteriores”.");
      window.dispatchEvent(new Event("mural:atualizado"));
      setConfirmando(null);
      router.refresh();
    });
  }

  return (
    <section
      id="mural"
      className="scroll-mt-[calc(var(--header-height)+1rem)] bg-white rounded-xl border border-border p-4 mb-4"
      data-figma="MuralCard"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[0.8125rem] font-semibold">📢 Mural de Mensagens</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoricoAberto(true)}
            className="border-none bg-transparent px-2 py-1 font-sans text-xs font-semibold text-brand cursor-pointer rounded-md hover:bg-[rgba(27,153,86,0.06)]"
          >
            Ver anteriores
          </button>
          {podeCriar && <Button label="Nova mensagem" onClick={abrirNova} />}
        </div>
      </div>

      {mensagens.length === 0 ? (
        <p className="m-0 py-2 text-xs text-[#8a8f9a]">
          Nenhuma mensagem no mural no momento.
        </p>
      ) : (
        <ul className="m-0 flex max-h-[18rem] list-none flex-col gap-2 overflow-y-auto p-0">
          {mensagens.map((mensagem) => {
            const nova =
              vistoEmMs === null ||
              new Date(mensagem.data_publicacao).getTime() > vistoEmMs;
            return (
              <li
                key={mensagem.id}
                className="rounded-lg bg-[#f2f4f8] px-[0.875rem] py-[0.625rem]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {mensagem.titulo && (
                        <strong className="text-xs text-ink-strong">
                          {mensagem.titulo}
                        </strong>
                      )}
                      {nova && (
                        <span className="rounded-full bg-brand px-2 py-px text-[0.625rem] font-semibold text-white">
                          Nova
                        </span>
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
                        ? ` · expira em ${formatarData(mensagem.data_expiracao)}`
                        : ""}
                    </div>
                  </div>

                  {!mensagem.automatica && (podeAlterar || podeExcluir) && (
                    <div className="flex shrink-0 items-center gap-1">
                      {podeAlterar && (
                        <button
                          type="button"
                          className={acaoBtnCls}
                          title="Editar mensagem"
                          aria-label="Editar mensagem"
                          onClick={() => abrirEdicao(mensagem)}
                        >
                          <Pencil size={14} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          type="button"
                          className={acaoBtnCls}
                          title="Desativar mensagem"
                          aria-label="Desativar mensagem"
                          onClick={() => setConfirmando(mensagem)}
                        >
                          <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <MuralMensagemModal
        key={`${emEdicao?.id ?? "nova"}-${versaoModal}`}
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        mensagem={emEdicao}
      />
      {historicoAberto && (
        <MuralHistoricoModal open onClose={() => setHistoricoAberto(false)} />
      )}
      <ConfirmDialog
        open={confirmando !== null}
        onClose={() => setConfirmando(null)}
        onConfirm={confirmarDesativacao}
        title="Desativar mensagem"
        message="A mensagem sai do mural e fica disponível em “Ver anteriores”. Nada é apagado."
        confirmLabel={desativando ? "Desativando..." : "Desativar"}
        loading={desativando}
      />
    </section>
  );
}
