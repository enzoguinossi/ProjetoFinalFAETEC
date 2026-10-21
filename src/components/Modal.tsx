"use client";

import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

/**
 * Modal do sistema.
 *
 * A superfície visual (e a marca `data-figma`) continua em um único elemento:
 * o overlay é `div.fixed.inset-0` (a colheita do Figma espera exatamente esse
 * seletor) e o conteúdo é seu filho — a mesma árvore que o `dom-walker` içava
 * antes do Radix. O `Dialog.Content` fica aninhado no overlay para preservar o
 * centralizar por `flex`; o portal é feito pelo Radix (um portal por filho).
 *
 * O Radix entrega: `role="dialog"`, `aria-labelledby` (via `Dialog.Title`),
 * foco preso com ciclo, restauração de foco, fechamento por Escape e bloqueio
 * de scroll do fundo. O clique fora só fecha quando o `pointerdown` COMEÇA
 * fora do conteúdo — arrastar de dentro para fora não descarta o formulário.
 */
export default function Modal({ open, onClose, title, children, width }: ModalProps) {
  const focoAnterior = useRef<HTMLElement | null>(null);
  const estavaAberto = useRef(false);

  // O Radix foca o "trigger" ao fechar; como estes modais são controlados por
  // fora e não têm `Dialog.Trigger`, a restauração do foco é feita aqui.
  useEffect(() => {
    if (open) {
      if (!estavaAberto.current) {
        const ativo = document.activeElement;
        focoAnterior.current = ativo instanceof HTMLElement ? ativo : null;
        estavaAberto.current = true;
      }
      return;
    }
    if (!estavaAberto.current) return;
    estavaAberto.current = false;
    const alvo = focoAnterior.current;
    focoAnterior.current = null;
    if (alvo && alvo.isConnected) alvo.focus();
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[rgba(0,0,0,0.4)] flex items-center justify-center z-[1000]">
          <Dialog.Content
            className="bg-white border-t-[13px] border-[#1b9956] rounded-[26px] w-[728px] max-h-[90vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden outline-none"
            style={width ? { width } : undefined}
            aria-modal="true"
            aria-label={title ? undefined : "Janela de diálogo"}
            data-figma="Modal"
            data-figma-title={title ?? ""}
          >
            {title && (
              <div className="flex items-center justify-between pt-4 px-5 shrink-0">
                <Dialog.Title className="font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] m-0 text-ink-strong">
                  {title}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    className="flex items-center justify-center w-8 h-8 border-none rounded-md bg-transparent cursor-pointer text-ink hover:bg-[#f2f4f8]"
                    type="button"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M15 5L5 15M5 5L15 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </Dialog.Close>
              </div>
            )}
            <div className="overflow-y-auto p-8">{children}</div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
