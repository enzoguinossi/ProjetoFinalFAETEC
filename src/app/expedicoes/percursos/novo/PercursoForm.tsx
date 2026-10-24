"use client";

import { useState } from "react";
import Button from "@/components/Button";
import SearchEntityModal from "@/components/SearchEntityModal";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import { salvarPercurso, listarDestinatariosParaPercurso } from "../actions";
import type { DestinatarioPercursoRow, PercursoFormData } from "../actions";
import type { Column } from "@/components/DataTable";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: PercursoFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type ItemSelecionado = {
  id_destinatario: number;
  razao_social: string;
  tipo: "ESCOLA" | "CRECHE";
  ordem_visita: number;
};

const COLUNAS_DESTINATARIO: Column<DestinatarioPercursoRow>[] = [
  { key: "razao_social", label: "Razão social", width: "3fr", align: "left" },
  {
    key: "tipo",
    label: "Tipo",
    width: "1fr",
    align: "center",
    render: (value) => (value === "CRECHE" ? "Creche" : "Escola"),
  },
];

const ROTULO_TIPO: Record<string, string> = {
  ESCOLA: "Escola",
  CRECHE: "Creche",
};

function renumerar(lista: ItemSelecionado[]): ItemSelecionado[] {
  return lista.map((item, indice) => ({ ...item, ordem_visita: indice + 1 }));
}

export default function PercursoForm({
  mode = "create",
  initialData,
  onSuccess,
  onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [destinatarios, setDestinatarios] = useState<ItemSelecionado[]>(() =>
    renumerar(initialData?.destinatarios ?? []),
  );
  const [buscandoDestinatario, setBuscandoDestinatario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const mostrarAviso = useAviso();

  function adicionarDestinatario(destinatario: DestinatarioPercursoRow) {
    setDestinatarios((atuais) =>
      renumerar([
        ...atuais,
        {
          id_destinatario: destinatario.id_destinatario,
          razao_social: destinatario.razao_social,
          tipo: destinatario.tipo,
          ordem_visita: atuais.length + 1,
        },
      ]),
    );
  }

  function mover(indice: number, delta: number) {
    setDestinatarios((atuais) => {
      const alvo = indice + delta;
      if (alvo < 0 || alvo >= atuais.length) return atuais;

      const copia = [...atuais];
      const [item] = copia.splice(indice, 1);
      if (!item) return atuais;
      copia.splice(alvo, 0, item);
      return renumerar(copia);
    });
  }

  function remover(id_destinatario: number) {
    setDestinatarios((atuais) =>
      renumerar(atuais.filter((d) => d.id_destinatario !== id_destinatario)),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;

    setSalvando(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_percurso", String(initialData.id_percurso));
      form.set(
        "destinatarios",
        JSON.stringify(
          destinatarios.map((d) => ({
            id_destinatario: d.id_destinatario,
            ordem_visita: d.ordem_visita,
          })),
        ),
      );

      const resultado = await salvarPercurso(form);
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }

      mostrarAviso(
        isEdit ? "Alterações salvas com sucesso." : "Percurso cadastrado com sucesso.",
        "sucesso",
      );
      onSuccess?.();
    } catch {
      mostrarAviso("Erro ao salvar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  const gridCols = isView ? "5rem 1fr" : "5rem 1fr 11rem";

  return (
    <form onSubmit={handleSubmit} className={ui.form}>
      <div className={ui.field}>
        <label className={ui.label}>Nome</label>
        <input
          name="nome"
          required={!isView}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          readOnly={isView}
          className={ui.input}
        />
      </div>

      <div className={ui.field}>
        <label className={ui.label}>Descrição</label>
        <textarea
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          readOnly={isView}
          rows={3}
          className={`${ui.input} h-auto py-2 resize-y`}
        />
      </div>

      <div className={ui.field}>
        <div className="flex items-center justify-between gap-4">
          <label className={ui.label}>Destinatários</label>
          {!isView && (
            <Button
              label="Adicionar destinatário"
              variant="ghost"
              onClick={() => setBuscandoDestinatario(true)}
            />
          )}
        </div>

        {destinatarios.length === 0 ? (
          <p className="m-0 rounded-lg border border-border-input bg-[#f8f9fb] px-4 py-3 font-sans text-sm text-[#697077]">
            Nenhum destinatário selecionado. Ao menos um é obrigatório.
          </p>
        ) : (
          <div className="flex flex-col rounded-[1.25rem] overflow-hidden border border-[#e2e8f0]">
            <div
              className="grid bg-brand text-white font-display text-base [font-weight:590] tracking-[-0.028125rem]"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="px-[0.6875rem] py-2 text-center">Ordem</div>
              <div className="px-[0.6875rem] py-2">Destinatário</div>
              {!isView && (
                <div className="px-[0.6875rem] py-2 text-center">Ações</div>
              )}
            </div>

            {destinatarios.map((destinatario, indice) => (
              <div
                key={destinatario.id_destinatario}
                className={`grid items-center bg-white font-sans text-base text-ink ${
                  indice % 2 === 1 ? "bg-table-alt!" : ""
                }`}
                style={{ gridTemplateColumns: gridCols }}
              >
                <div className="px-[0.6875rem] py-2 text-center font-semibold">
                  {destinatario.ordem_visita}
                </div>
                <div className="px-[0.6875rem] py-2 overflow-hidden text-ellipsis whitespace-nowrap">
                  {destinatario.razao_social}
                  <span className="ml-2 text-[0.75rem] text-[#697077]">
                    {ROTULO_TIPO[destinatario.tipo] ?? destinatario.tipo}
                  </span>
                </div>
                {!isView && (
                  <div className="flex items-center justify-center gap-1 px-[0.6875rem] py-1">
                    <button
                      type="button"
                      className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-white text-ink cursor-pointer disabled:opacity-40 disabled:cursor-default"
                      aria-label={`Subir ${destinatario.razao_social}`}
                      title="Subir"
                      disabled={indice === 0}
                      onClick={() => mover(indice, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-white text-ink cursor-pointer disabled:opacity-40 disabled:cursor-default"
                      aria-label={`Descer ${destinatario.razao_social}`}
                      title="Descer"
                      disabled={indice === destinatarios.length - 1}
                      onClick={() => mover(indice, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="ml-1 px-2 py-1 border border-border rounded-md bg-white font-sans text-[0.8125rem] text-danger cursor-pointer transition-[background-color] duration-100 hover:bg-danger-bg"
                      onClick={() => remover(destinatario.id_destinatario)}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={ui.rowActions}>
        {isView ? (
          <Button label="Fechar" variant="cancel" onClick={onCancel} />
        ) : (
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button
              label={isEdit ? "Salvar" : "Gravar"}
              variant="primary"
              type="submit"
              disabled={salvando}
            />
          </>
        )}
      </div>

      <SearchEntityModal<DestinatarioPercursoRow>
        open={buscandoDestinatario}
        onClose={() => setBuscandoDestinatario(false)}
        onSelect={adicionarDestinatario}
        title="Selecionar Destinatário"
        columns={COLUNAS_DESTINATARIO}
        loadPage={listarDestinatariosParaPercurso}
        getItemId={(d) => d.id_destinatario}
        excludeIds={destinatarios.map((d) => d.id_destinatario)}
        placeholder="Filtrar destinatário por razão social..."
      />
    </form>
  );
}
