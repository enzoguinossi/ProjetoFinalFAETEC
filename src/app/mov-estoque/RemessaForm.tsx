"use client";

import { useState } from "react";
import Button from "@/components/Button";
import SearchEntityModal from "@/components/SearchEntityModal";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import { COLUNAS_PRODUTO, type ProdutoListRow } from "@/lib/produto-linha";
import { COLUNAS_DESTINATARIO } from "./colunas-selecao";
import { INPUT_CLASS, LABEL_CLASS } from "./form-ui";
import { listarDestinatariosSelecao, listarProdutosSelecao, salvarRemessa } from "./actions";
import type {
  CondutorItem,
  DestinatarioSelecaoRow,
  RemessaFormData,
  VeiculoItem,
} from "./tipos";

interface Props {
  mode: "edit" | "view";
  initialData: RemessaFormData;
  condutores: CondutorItem[];
  veiculos: VeiculoItem[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

type ItemForm = {
  uid: number;
  /** Item já gravado na remessa (`null` = item novo, ainda não salvo). */
  id_item_remessa: number | null;
  id_produto: number;
  descricao: string;
  separada: number | null;
  entregue: number | null;
  quantidade: string;
};

function formatarNumero(valor: number | null): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(valor);
}

let proximoUid = 1;

/**
 * Visualização e edição de **uma** remessa. A criação continua no `SaidaForm`
 * (dentro do formulário da nota), que é onde as remessas são planejadas.
 */
export default function RemessaForm({
  mode,
  initialData,
  condutores,
  veiculos,
  onSaved,
  onCancel,
}: Props) {
  const mostrarAviso = useAviso();
  const isView = mode === "view";
  const podeEditar = !isView && initialData.podeEditar;

  const [destinatario, setDestinatario] = useState<DestinatarioSelecaoRow>({
    id_destinatario: initialData.id_destinatario,
    razao_social: initialData.destinatario,
    tipo: "",
  });
  const [condutor, setCondutor] = useState(
    initialData.id_funcionario_condutor === null
      ? ""
      : String(initialData.id_funcionario_condutor),
  );
  const [veiculo, setVeiculo] = useState(
    initialData.id_veiculo === null ? "" : String(initialData.id_veiculo),
  );
  const [urgente, setUrgente] = useState(initialData.urgente);
  const [observacao, setObservacao] = useState(initialData.observacao ?? "");
  const [itens, setItens] = useState<ItemForm[]>(() =>
    initialData.itens.map((item) => ({
      uid: proximoUid++,
      id_item_remessa: item.id_item_remessa,
      id_produto: item.id_produto,
      descricao: item.descricao,
      separada: item.quantidade_separada,
      entregue: item.quantidade_entregue,
      quantidade: String(item.quantidade_solicitada),
    })),
  );
  const [salvando, setSalvando] = useState(false);
  const [buscandoDestinatario, setBuscandoDestinatario] = useState(false);
  const [buscandoProduto, setBuscandoProduto] = useState(false);

  function alterarItem(uid: number, quantidade: string) {
    setItens((atuais) =>
      atuais.map((item) => (item.uid === uid ? { ...item, quantidade } : item)),
    );
  }

  function removerItem(uid: number) {
    // Só itens novos (ainda não gravados) podem sair: apagar um item já
    // registrado perderia a rastreabilidade (RN004).
    setItens((atuais) =>
      atuais.filter((item) => item.uid !== uid || item.id_item_remessa !== null),
    );
  }

  function adicionarItem(produto: ProdutoListRow) {
    setItens((atuais) => [
      ...atuais,
      {
        uid: proximoUid++,
        id_item_remessa: null,
        id_produto: produto.id_produto,
        descricao: produto.descricao,
        separada: null,
        entregue: null,
        quantidade: "1",
      },
    ]);
  }

  async function gravar() {
    if (!podeEditar) return;

    if (itens.length === 0) {
      mostrarAviso("Informe ao menos um item na remessa.", "erro");
      return;
    }
    const ids = new Set<number>();
    for (const item of itens) {
      if (!(Number(item.quantidade) > 0)) {
        mostrarAviso("A quantidade solicitada deve ser maior que zero.", "erro");
        return;
      }
      if (ids.has(item.id_produto)) {
        mostrarAviso("O mesmo produto não pode aparecer mais de uma vez na mesma remessa.", "erro");
        return;
      }
      ids.add(item.id_produto);
    }

    setSalvando(true);
    try {
      const resultado = await salvarRemessa(initialData.id_remessa, {
        id_destinatario: destinatario.id_destinatario,
        id_funcionario_condutor: condutor ? Number(condutor) : null,
        id_veiculo: veiculo ? Number(veiculo) : null,
        urgente,
        observacao: observacao.trim() || null,
        itens: itens.map((item) => ({
          id_item_remessa: item.id_item_remessa,
          id_produto: item.id_produto,
          quantidade_solicitada: Number(item.quantidade),
        })),
      });

      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Remessa atualizada com sucesso.", "sucesso");
      await onSaved();
    } catch {
      mostrarAviso("Erro ao atualizar a remessa. Tente novamente.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={ui.form}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={ui.field}>
          <label className={LABEL_CLASS}>Status</label>
          <input readOnly value={initialData.statusLabel} className={INPUT_CLASS} />
        </div>

        <div className={ui.field}>
          <label className={LABEL_CLASS}>Destinatário</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={destinatario.razao_social}
              placeholder="Obrigatório"
              className={INPUT_CLASS}
            />
            {podeEditar && (
              <button
                type="button"
                onClick={() => setBuscandoDestinatario(true)}
                aria-label="Selecionar destinatário"
                title="Selecionar destinatário"
                className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-border-input bg-white text-brand cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className={ui.field}>
          <label className={LABEL_CLASS}>Condutor (opcional)</label>
          {podeEditar ? (
            <select
              value={condutor}
              onChange={(e) => setCondutor(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">—</option>
              {condutores.map((c) => (
                <option key={c.id_funcionario} value={c.id_funcionario}>
                  {c.nome}
                </option>
              ))}
            </select>
          ) : (
            <input readOnly value={initialData.condutor ?? ""} placeholder="—" className={INPUT_CLASS} />
          )}
        </div>

        <div className={ui.field}>
          <label className={LABEL_CLASS}>Veículo (opcional)</label>
          {podeEditar ? (
            <select
              value={veiculo}
              onChange={(e) => setVeiculo(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">—</option>
              {veiculos.map((v) => (
                <option key={v.id_veiculo} value={v.id_veiculo}>
                  {v.modelo ? `${v.placa} — ${v.modelo}` : v.placa}
                </option>
              ))}
            </select>
          ) : (
            <input readOnly value={initialData.veiculo ?? ""} placeholder="—" className={INPUT_CLASS} />
          )}
        </div>

        <div className={ui.field}>
          <label className={LABEL_CLASS}>Observação (opcional)</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
            readOnly={!podeEditar}
            className={INPUT_CLASS}
          />
        </div>

        <label className="flex items-center gap-2 font-sans text-sm text-ink-strong">
          <input
            type="checkbox"
            checked={urgente}
            onChange={(e) => setUrgente(e.target.checked)}
            disabled={!podeEditar}
            className="h-4 w-4 accent-brand"
          />
          Urgente
        </label>
      </div>

      {!isView && !initialData.podeEditar && (
        <p className="m-0 font-sans text-sm text-[#697077]">
          Esta remessa está {initialData.statusLabel.toLowerCase()} e não pode ser editada — o
          histórico é preservado (RN004).
        </p>
      )}

      <div className={ui.field}>
        <div className="flex items-center justify-between">
          <label className={LABEL_CLASS}>Itens da remessa</label>
          {podeEditar && (
            <Button label="Adicionar item" variant="ghost" onClick={() => setBuscandoProduto(true)} />
          )}
        </div>

        {podeEditar && (
          <p className="m-0 font-sans text-sm text-[#697077]">
            Itens já registrados podem ter a quantidade solicitada corrigida, mas não podem ser
            removidos — a remessa preserva a rastreabilidade.
          </p>
        )}

        {itens.length === 0 ? (
          <p className="m-0 font-sans text-sm text-[#697077]">
            Nenhum item adicionado. Use &quot;Adicionar item&quot; para buscar o produto.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {itens.map((item) => (
              <div
                key={item.uid}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[2fr_0.8fr_0.7fr_0.7fr_auto]"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-xs text-[#697077]">Produto</span>
                  <span className="font-sans text-base text-ink-strong">{item.descricao}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-sans text-xs text-[#697077]">Solicitada</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.quantidade}
                    onChange={(e) => alterarItem(item.uid, e.target.value)}
                    readOnly={!podeEditar}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-sans text-xs text-[#697077]">Separada</span>
                  <span className="font-sans text-base text-ink-strong">
                    {formatarNumero(item.separada)}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-sans text-xs text-[#697077]">Entregue</span>
                  <span className="font-sans text-base text-ink-strong">
                    {formatarNumero(item.entregue)}
                  </span>
                </div>

                <div className="flex items-end justify-end">
                  {podeEditar && item.id_item_remessa === null && (
                    <Button label="Remover" variant="cancel" onClick={() => removerItem(item.uid)} />
                  )}
                </div>
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
              label={salvando ? "Salvando..." : "Salvar alterações"}
              variant="primary"
              onClick={gravar}
              disabled={salvando || !initialData.podeEditar || itens.length === 0}
            />
          </>
        )}
      </div>

      <SearchEntityModal<DestinatarioSelecaoRow>
        open={buscandoDestinatario}
        onClose={() => setBuscandoDestinatario(false)}
        onSelect={setDestinatario}
        title="Selecionar Destinatário"
        columns={COLUNAS_DESTINATARIO}
        loadPage={listarDestinatariosSelecao}
        getItemId={(d) => d.id_destinatario}
        placeholder="Filtrar destinatário por razão social..."
      />

      <SearchEntityModal<ProdutoListRow>
        open={buscandoProduto}
        onClose={() => setBuscandoProduto(false)}
        onSelect={adicionarItem}
        title="Selecionar Produto"
        columns={COLUNAS_PRODUTO}
        loadPage={listarProdutosSelecao}
        excludeIds={itens.map((item) => item.id_produto)}
        getItemId={(p) => p.id_produto}
        placeholder="Filtrar produto por código ou descrição..."
      />
    </div>
  );
}
