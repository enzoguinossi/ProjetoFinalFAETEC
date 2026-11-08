"use client";

import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import UsuarioForm from "./novo/UsuarioForm";
import SituacaoBadge from "@/components/SituacaoBadge";
import type { Column } from "@/components/DataTable";
import { useState } from "react";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
import { OPCOES_SITUACAO, situacaoParaAtivo } from "@/lib/filtros-situacao";
import {
  listarUsuarios,
  getUsuario,
  deleteUsuario,
  type UsuarioListRow,
  type UsuarioFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<UsuarioListRow>;
  funcionarios: { id_funcionario: number; pessoaFisica: { nome: string } }[];
  grupos: { prefixo: string; permissoes: { id_permissao: number; nome: string; descricao: string | null }[] }[];
  perfis: { id_perfil: number; nome: string; descricao: string | null }[];
  perfilPermissoes: Record<number, string[]>;
  perms: PermissoesEntidade;
}

const columns: Column<UsuarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr", align: "center" },
  { key: "nome", label: "Nome", width: "3fr", align: "left" },
  { key: "login", label: "Login", width: "2fr", align: "left" },
  {
    key: "ativo",
    label: "Situação",
    width: "1fr",
    align: "center",
    render: (_value, row) => <SituacaoBadge ativo={row.ativo} />,
  },
];

export default function UsuariosClient({ inicial, funcionarios, grupos, perfis, perfilPermissoes, perms }: Props) {
  const router = useRouter();
  const {
    resultado,
    carregando,
    buscarPorTermo,
    aplicarFiltros,
    paginacaoServidor,
    actions,
    modalMode,
    formData,
    abrirNovo,
    fecharModal,
    aoSalvar,
    deleteTarget,
    setDeleteTarget,
    confirmarExclusao,
    excluindo,
  } = useCrudLista<UsuarioListRow, UsuarioFormData>({
    buscar: listarUsuarios,
    inicial,
    carregar: getUsuario,
    excluir: deleteUsuario,
    idDe: (row) => row.id_usuario,
    perms,
    mensagemExcluido: "Usuário excluído com sucesso.",
  });

  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);

  const camposFiltro: CampoFiltro[] = [
    {
      id: "situacao",
      rotulo: "Situação",
      tipo: "multi",
      opcoes: [...OPCOES_SITUACAO],
    },
    { id: "superAdmin", rotulo: "Somente super admin", tipo: "checkbox" },
  ];

  function aplicarFiltrosTela(novos: Valores) {
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
    const superAdmin = novos.superAdmin;
    aplicarFiltros({
      ativo: situacaoParaAtivo(novos.situacao),
      superAdmin:
        Array.isArray(superAdmin) && superAdmin.includes("1") ? true : undefined,
    });
  }

  function limparFiltrosTela() {
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
    aplicarFiltros({});
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Pesquisar usuários..."
            onNew={abrirNovo}
            onSearch={buscarPorTermo}
            showNew={perms.canCreate}
          />
        </div>
        <Button label="Gerenciar perfis" onClick={() => router.push("/perfis")} />
      </div>
      <BarraFiltrosBase
        key={chaveFiltros}
        campos={camposFiltro}
        valores={valoresFiltros}
        onAplicar={aplicarFiltrosTela}
        onLimpar={limparFiltrosTela}
      />
      <DataTable
        columns={columns}
        data={resultado.data}
        idField="codigo"
        actions={actions}
        paginacaoServidor={paginacaoServidor}
        carregando={carregando}
      />

      <Modal open={modalMode === "create"} onClose={fecharModal} width="min(1000px, calc(100vw - 32px))">
        <UsuarioForm
          funcionarios={funcionarios}
          grupos={grupos}
          perfis={perfis}
          perfilPermissoes={perfilPermissoes}
          mode="create"
          onSuccess={aoSalvar}
          onCancel={fecharModal}
        />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="min(1000px, calc(100vw - 32px))">
        {formData && (
          <UsuarioForm
            funcionarios={funcionarios}
            grupos={grupos}
            perfis={perfis}
            perfilPermissoes={perfilPermissoes}
            mode="edit"
            initialData={formData}
            canDeactivate={perms.canDeactivate}
            onSuccess={aoSalvar}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={fecharModal} width="min(1000px, calc(100vw - 32px))">
        {formData && (
          <UsuarioForm
            funcionarios={funcionarios}
            grupos={grupos}
            perfis={perfis}
            perfilPermissoes={perfilPermissoes}
            mode="view"
            initialData={formData}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir usuário"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"?`}
        confirmLabel="Excluir"
        loading={excluindo}
      />
    </>
  );
}
