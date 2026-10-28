"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import { aprovarPedido, recusarPedido } from "../actions";

interface Props {
  id: number;
  podeAnalisar: boolean;
}

/** Aprovar/recusar no detalhe do pedido (histórico preservado pelo status). */
export default function PedidoAcoes({ id, podeAnalisar }: Props) {
  const router = useRouter();
  const mostrarAviso = useAviso();
  const [processando, setProcessando] = useState(false);
  const [confirmandoRecusa, setConfirmandoRecusa] = useState(false);

  async function executar(acao: "aprovar" | "recusar") {
    setProcessando(true);
    try {
      const resposta =
        acao === "aprovar" ? await aprovarPedido(id) : await recusarPedido(id);
      if ("error" in resposta) {
        mostrarAviso(resposta.error, "erro");
        return;
      }
      mostrarAviso(
        acao === "aprovar"
          ? "Pedido aprovado e disponível para importar na Saída."
          : "Pedido recusado.",
        "sucesso",
      );
      setConfirmandoRecusa(false);
      router.refresh();
    } finally {
      setProcessando(false);
    }
  }

  if (!podeAnalisar) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        label={processando ? "Processando..." : "Aprovar pedido"}
        onClick={() => void executar("aprovar")}
        disabled={processando}
      />
      <Button
        label="Recusar pedido"
        variant="cancel"
        onClick={() => setConfirmandoRecusa(true)}
        disabled={processando}
      />

      <ConfirmDialog
        open={confirmandoRecusa}
        onClose={() => setConfirmandoRecusa(false)}
        onConfirm={() => void executar("recusar")}
        title="Recusar pedido"
        message="O pedido fica recusado no histórico e não pode ser importado na Saída."
        confirmLabel="Recusar"
        loading={processando}
      />
    </div>
  );
}
