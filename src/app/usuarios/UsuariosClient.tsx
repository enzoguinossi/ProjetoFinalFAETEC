"use client";

import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import UsuarioForm from "./novo/UsuarioForm";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
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
];

export default function UsuariosClient({ inicial, funcionarios, grupos, perfis, perfilPermissoes, perms }: Props) {
  const router = useRouter();
  const {
    resultado,
    carregando,
    buscarPorTermo,
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
      <DataTable
        columns={columns}
        data={resultado.data}
        idField="codigo"
        actions={actions}
        paginacaoServidor={paginacaoServidor}
        carregando={carregando}
      />

      <Modal open={modalMode === "create"} onClose={fecharModal} width="1000px">
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

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="1000px">
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

      <Modal open={modalMode === "view" && formData !== null} onClose={fecharModal} width="1000px">
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
