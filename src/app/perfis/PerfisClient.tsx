"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import type { Column, Action } from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import { useAviso } from "@/components/AvisoProvider";
import Button from "@/components/Button";
import PerfilForm from "./novo/PerfilForm";
import type { PerfilListRow, PerfilFormData } from "./actions";
import { getPerfil, excluirPerfil } from "./actions";
import { rotuloGrupo, type GrupoPermissoes } from "@/components/PermissoesPanel";

interface Props {
  rows: PerfilListRow[];
  grupos: GrupoPermissoes[];
}

const columns: Column<PerfilListRow>[] = [
  { key: "nome", label: "Nome", width: "2fr", align: "left" },
  { key: "descricao", label: "Descrição", width: "3fr", align: "left" },
  {
    key: "permissoes", label: "Permissões", width: "1fr", align: "right",
    render: (v) => String((v as string[])?.length ?? 0),
  },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function PerfisClient({ rows: initialRows, grupos }: Props) {
  const router = useRouter();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<PerfilFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerfilListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [termo, setTermo] = useState("");
  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);
  const mostrarAviso = useAviso();

  const camposFiltro: CampoFiltro[] = [
    {
      id: "grupo",
      rotulo: "Grupo de permissões",
      tipo: "multi",
      opcoes: grupos.map((grupo) => ({
        valor: grupo.prefixo,
        rotulo: rotuloGrupo(grupo.prefixo),
      })),
    },
  ];

  const busca = termo.trim().toLowerCase();
  const gruposSelecionados = Array.isArray(valoresFiltros.grupo) ? valoresFiltros.grupo : [];
  const permissoesDosGrupos = new Set(
    grupos
      .filter((grupo) => gruposSelecionados.includes(grupo.prefixo))
      .flatMap((grupo) => grupo.permissoes.map((permissao) => permissao.nome)),
  );

  // Filtro client-side: a tela recebe todas as linhas e o DataTable pagina em memória.
  const rows = initialRows.filter((row) => {
    const casaBusca =
      busca.length === 0 ||
      row.nome.toLowerCase().includes(busca) ||
      (row.descricao ?? "").toLowerCase().includes(busca);
    const casaGrupo =
      permissoesDosGrupos.size === 0 ||
      row.permissoes.some((permissao) => permissoesDosGrupos.has(permissao));
    return casaBusca && casaGrupo;
  });

  function aplicarFiltrosTela(novos: Valores) {
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
  }

  function limparFiltrosTela() {
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
  }

  async function openModal(id: number, mode: "edit" | "view") {
    const data = await getPerfil(id);
    setFormData(data);
    setModalMode(mode);
  }

  function closeModal() { setModalMode(null); setFormData(null); }
  function handleSuccess() { closeModal(); router.refresh(); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await excluirPerfil(deleteTarget.id_perfil);
      if (r.error) { mostrarAviso(r.error, "erro"); return; }
      mostrarAviso("Perfil excluído com sucesso.", "sucesso");
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const actions: Action<PerfilListRow>[] = [
    { icon: "/icons/actions/Olho.svg", label: "Visualizar", onClick: (row) => openModal(row.id_perfil, "view") },
    { icon: "/icons/actions/Editar.svg", label: "Editar", onClick: (row) => openModal(row.id_perfil, "edit") },
    { icon: "/icons/actions/Lixeira.svg", label: "Excluir", onClick: (row) => setDeleteTarget(row) },
  ];

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Pesquisar perfis..."
            onSearch={setTermo}
            onNew={() => setModalMode("create")}
            showNew
          />
        </div>
        <Button label="Voltar" variant="cancel" onClick={() => router.push("/usuarios")} />
      </div>

      <BarraFiltrosBase
        key={chaveFiltros}
        campos={camposFiltro}
        valores={valoresFiltros}
        onAplicar={aplicarFiltrosTela}
        onLimpar={limparFiltrosTela}
      />

      <DataTable
        key={`${termo}-${JSON.stringify(valoresFiltros)}`}
        columns={columns}
        data={rows}
        idField="id_perfil"
        actions={actions}
      />

      <Modal open={modalMode === "create"} onClose={closeModal} width="min(860px, calc(100vw - 32px))" title="Novo Perfil">
        <PerfilForm grupos={grupos} mode="create" onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="min(860px, calc(100vw - 32px))" title="Editar perfil">
        {formData && (
          <PerfilForm grupos={grupos} mode="edit" initialData={formData} onSuccess={handleSuccess} onCancel={closeModal} />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={closeModal} width="min(860px, calc(100vw - 32px))" title="Visualizar perfil">
        {formData && (
          <PerfilForm grupos={grupos} mode="view" initialData={formData} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir perfil"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? As permissões já aplicadas aos usuários não serão removidas.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
