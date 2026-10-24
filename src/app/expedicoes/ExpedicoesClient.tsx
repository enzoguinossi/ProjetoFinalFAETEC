"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import SearchBar from "@/components/SearchBar";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import { useListaPaginada } from "@/lib/use-lista-paginada";
import type { Action, Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import {
  desativarExpedicao,
  listarCondutoresParaExpedicao,
  listarExpedicoes,
  listarPercursosParaExpedicao,
  listarVeiculosParaExpedicao,
  salvarExpedicao,
  type CondutorExpedicaoRow,
  type ExpedicaoListRow,
  type PercursoExpedicaoRow,
  type VeiculoExpedicaoRow,
} from "./actions";

interface Props {
  inicial: PaginatedResult<ExpedicaoListRow>;
  perms: PermissoesEntidade;
}

function formatarData(valor: string | null): string {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}

const statusCls: Record<string, string> = {
  PLANEJADA: "bg-[#e8f0fe] text-[#001d6c]",
  EM_PERCURSO: "bg-[#fff4e5] text-[#7a4100]",
  CONCLUIDA: "bg-[#e7f6ec] text-[#0f5132]",
};

const columns: Column<ExpedicaoListRow>[] = [
  {
    key: "data_prevista",
    label: "Data prevista",
    width: "1.1fr",
    render: (value) => formatarData(value ? String(value) : null),
  },
  {
    key: "statusLabel",
    label: "Status",
    width: "1.1fr",
    align: "center",
    render: (_value, row) => (
      <span
        className={`inline-flex rounded-full px-3 py-1 font-sans text-xs font-semibold ${
          statusCls[row.status] ?? "bg-[#f2f4f8] text-ink"
        }`}
      >
        {row.statusLabel}
      </span>
    ),
  },
  {
    key: "total_notas",
    label: "Notas",
    width: "0.7fr",
    align: "center",
    render: (value) => String(value ?? 0),
  },
  { key: "destinatarios", label: "Destinatários", width: "3fr" },
  {
    key: "veiculo",
    label: "Veículo",
    width: "1fr",
    render: (value) => (value ? String(value) : "—"),
  },
];

function ExpedicaoForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const mostrarAviso = useAviso();
  const [dataPrevista, setDataPrevista] = useState("");
  const [observacao, setObservacao] = useState("");
  const [idVeiculo, setIdVeiculo] = useState("");
  const [idCondutor, setIdCondutor] = useState("");
  const [idPercurso, setIdPercurso] = useState("");
  const [veiculos, setVeiculos] = useState<VeiculoExpedicaoRow[]>([]);
  const [condutores, setCondutores] = useState<CondutorExpedicaoRow[]>([]);
  const [percursos, setPercursos] = useState<PercursoExpedicaoRow[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;

    void (async () => {
      const [listaVeiculos, listaCondutores, listaPercursos] =
        await Promise.all([
          listarVeiculosParaExpedicao({ page: 1, limit: 100 }),
          listarCondutoresParaExpedicao({ page: 1, limit: 100 }),
          listarPercursosParaExpedicao({ page: 1, limit: 100 }),
        ]);
      if (!ativo) return;
      setVeiculos(listaVeiculos.data);
      setCondutores(listaCondutores.data);
      setPercursos(listaPercursos.data);
    })();

    return () => {
      ativo = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    try {
      const form = new FormData();
      form.set("data_prevista", dataPrevista);
      form.set("observacao", observacao);
      form.set("id_veiculo", idVeiculo);
      form.set("id_funcionario_condutor", idCondutor);
      form.set("id_percurso", idPercurso);

      const resultado = await salvarExpedicao(form);
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }

      mostrarAviso("Expedição criada com sucesso.", "sucesso");
      onSaved();
    } catch {
      mostrarAviso("Erro ao criar a expedição.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={ui.form}>
      <div className={ui.field}>
        <label className={ui.label}>Data prevista</label>
        <input
          type="date"
          value={dataPrevista}
          onChange={(e) => setDataPrevista(e.target.value)}
          className={ui.input}
        />
      </div>

      <div className={ui.field}>
        <label className={ui.label}>Observação</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          className={`${ui.input} h-auto py-2 resize-y`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={ui.field}>
          <label className={ui.label}>Veículo</label>
          <select
            value={idVeiculo}
            onChange={(e) => setIdVeiculo(e.target.value)}
            className={ui.select}
          >
            <option value="">Sem veículo</option>
            {veiculos.map((veiculo) => (
              <option key={veiculo.id_veiculo} value={veiculo.id_veiculo}>
                {veiculo.placa}
                {veiculo.modelo ? ` — ${veiculo.modelo}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Condutor</label>
          <select
            value={idCondutor}
            onChange={(e) => setIdCondutor(e.target.value)}
            className={ui.select}
          >
            <option value="">Sem condutor</option>
            {condutores.map((condutor) => (
              <option key={condutor.id_funcionario} value={condutor.id_funcionario}>
                {condutor.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={ui.field}>
        <label className={ui.label}>Percurso (opcional)</label>
        <select
          value={idPercurso}
          onChange={(e) => setIdPercurso(e.target.value)}
          className={ui.select}
        >
          <option value="">Sem percurso</option>
          {percursos.map((percurso) => (
            <option key={percurso.id_percurso} value={percurso.id_percurso}>
              {percurso.nome} ({percurso.destinatarios} destinatário(s))
            </option>
          ))}
        </select>
        <span className="font-sans text-xs text-[#697077]">
          Ao escolher um percurso, as notas elegíveis das escolas dele entram
          automaticamente, já na ordem do percurso. O percurso não fica gravado
          na expedição.
        </span>
      </div>

      <div className={ui.rowActions}>
        <Button label="Cancelar" variant="cancel" onClick={onCancel} />
        <Button
          label="Criar expedição"
          variant="primary"
          type="submit"
          disabled={salvando}
        />
      </div>
    </form>
  );
}

export default function ExpedicoesClient({ inicial, perms }: Props) {
  const router = useRouter();
  const mostrarAviso = useAviso();
  const lista = useListaPaginada(listarExpedicoes, inicial);

  const [novoAberto, setNovoAberto] = useState(false);
  const [desativando, setDesativando] = useState<ExpedicaoListRow | null>(null);
  const [processando, setProcessando] = useState(false);

  const actions: Action<ExpedicaoListRow>[] = [
    ...(perms.canView
      ? [
          {
            icon: "/icons/actions/Olho.svg",
            label: "Visualizar",
            onClick: (row: ExpedicaoListRow) => {
              router.push(`/expedicoes/${row.id_expedicao}`);
            },
          },
        ]
      : []),
    ...(perms.canEdit
      ? [
          {
            icon: "/icons/actions/Editar.svg",
            label: "Alterar",
            onClick: (row: ExpedicaoListRow) => {
              router.push(`/expedicoes/${row.id_expedicao}`);
            },
          },
        ]
      : []),
    ...(perms.canDeactivate
      ? [
          {
            icon: "/icons/actions/Lixeira.svg",
            label: "Desativar",
            onClick: (row: ExpedicaoListRow) => setDesativando(row),
          },
        ]
      : []),
  ];

  async function confirmarDesativacao() {
    if (!desativando) return;
    setProcessando(true);
    try {
      const resultado = await desativarExpedicao(desativando.id_expedicao);
      if ("error" in resultado && resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Expedição desativada com sucesso.", "sucesso");
      setDesativando(null);
      router.refresh();
    } catch {
      mostrarAviso("Erro ao desativar a expedição.", "erro");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBar
        placeholder="Pesquisar expedições..."
        novoLabel="Nova expedição"
        onNew={() => setNovoAberto(true)}
        onSearch={lista.buscarPorTermo}
        showNew={perms.canCreate}
      />

      <DataTable
        columns={columns}
        data={lista.resultado.data}
        idField="id_expedicao"
        actions={actions}
        paginacaoServidor={{
          total: lista.resultado.total,
          page: lista.resultado.page,
          pageSize: lista.resultado.limit,
          onPageChange: lista.irParaPagina,
          onPageSizeChange: lista.mudarTamanho,
        }}
        carregando={lista.carregando}
      />

      <Modal
        open={novoAberto}
        onClose={() => setNovoAberto(false)}
        title="Nova expedição"
        width="760px"
      >
        <ExpedicaoForm
          onSaved={() => {
            setNovoAberto(false);
            router.refresh();
          }}
          onCancel={() => setNovoAberto(false)}
        />
      </Modal>

      <ConfirmDialog
        open={desativando !== null}
        onClose={() => setDesativando(null)}
        onConfirm={() => {
          void confirmarDesativacao();
        }}
        title="Desativar expedição"
        message={`Tem certeza que deseja desativar a expedição #${desativando?.id_expedicao ?? ""}? O histórico é preservado; não há exclusão física.`}
        confirmLabel="Desativar"
        loading={processando}
      />
    </div>
  );
}
