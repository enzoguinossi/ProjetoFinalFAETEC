"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAviso } from "@/components/AvisoProvider";
import { useListaPaginada } from "./use-lista-paginada";
import type { Action, PaginacaoServidor } from "@/components/DataTable";
import type { ListParams, PaginatedResult, PermissoesEntidade } from "@/types";

export type ModoModal = "create" | "edit" | "view" | null;

interface OpcoesCrud<TRow, TForm> {
  buscar: (params: ListParams) => Promise<PaginatedResult<TRow>>;
  inicial: PaginatedResult<TRow>;
  carregar: (id: number) => Promise<TForm | null>;
  excluir: (id: number) => Promise<{ error?: string; success?: boolean }>;
  idDe: (row: TRow) => number;
  perms: PermissoesEntidade;
  mensagemExcluido: string;
}

export function useCrudLista<TRow, TForm>({
  buscar,
  inicial,
  carregar,
  excluir,
  idDe,
  perms,
  mensagemExcluido,
}: OpcoesCrud<TRow, TForm>) {
  const router = useRouter();
  const mostrarAviso = useAviso();
  const lista = useListaPaginada(buscar, inicial);

  const [modalMode, setModalMode] = useState<ModoModal>(null);
  const [formData, setFormData] = useState<TForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TRow | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  function abrirNovo() {
    setModalMode("create");
  }

  async function abrirModal(row: TRow, mode: "edit" | "view") {
    const dados = await carregar(idDe(row));
    if (!dados) return;
    setFormData(dados);
    setModalMode(mode);
  }

  function fecharModal() {
    setModalMode(null);
    setFormData(null);
  }

  function aoSalvar() {
    fecharModal();
    router.refresh();
  }

  async function confirmarExclusao() {
    if (!deleteTarget) return;
    setExcluindo(true);
    try {
      const resultado = await excluir(idDe(deleteTarget));
      if (resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso(mensagemExcluido, "sucesso");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      mostrarAviso("Erro ao excluir. Tente novamente.", "erro");
    } finally {
      setExcluindo(false);
    }
  }

  const actions: Action<TRow>[] = [
    ...(perms.canView
      ? [{
          icon: "/icons/actions/Olho.svg",
          label: "Visualizar",
          onClick: (row: TRow) => { void abrirModal(row, "view"); },
        }]
      : []),
    ...(perms.canEdit
      ? [{
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (row: TRow) => { void abrirModal(row, "edit"); },
        }]
      : []),
    ...(perms.canDelete
      ? [{
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (row: TRow) => setDeleteTarget(row),
        }]
      : []),
  ];

  const paginacaoServidor: PaginacaoServidor = {
    total: lista.resultado.total,
    page: lista.resultado.page,
    pageSize: lista.resultado.limit,
    onPageChange: lista.irParaPagina,
    onPageSizeChange: lista.mudarTamanho,
  };

  return {
    resultado: lista.resultado,
    carregando: lista.carregando,
    buscarPorTermo: lista.buscarPorTermo,
    paginacaoServidor,
    actions,
    modalMode,
    formData,
    abrirNovo,
    abrirModal,
    fecharModal,
    aoSalvar,
    deleteTarget,
    setDeleteTarget,
    confirmarExclusao,
    excluindo,
  };
}
