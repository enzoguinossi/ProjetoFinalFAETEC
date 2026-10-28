"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import {
  decidirAjuste,
  finalizarInventario,
  type InventarioDetalhe,
  type InventarioItemRow,
} from "../../actions";

function q(valor: number | null): string {
  if (valor === null) return "—";
  return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** A, B, ..., Z, AA, AB... — mesma legenda usada no detalhe do inventário. */
function letraColuna(indice: number): string {
  let n = indice;
  let letra = "";
  while (n >= 0) {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  }
  return letra;
}

/** Letra do funcionário na legenda do inventário ("?" quando não contou). */
function letra(
  funcionarios: { id_funcionario: number }[],
  idFuncionario: number,
): string {
  const indice = funcionarios.findIndex((f) => f.id_funcionario === idFuncionario);
  return indice < 0 ? "?" : letraColuna(indice);
}

function LinhaDecisao({
  item,
  inventarioId,
  podeVerSistema,
  funcionarios,
  onSalvo,
}: {
  item: InventarioItemRow;
  inventarioId: number;
  podeVerSistema: boolean;
  funcionarios: { id_funcionario: number; nome: string }[];
  onSalvo: () => void;
}) {
  const mostrarAviso = useAviso();
  const [origem, setOrigem] = useState(
    item.origem === "CONTAGEM" && item.id_contagem_inventario
      ? `CONTAGEM:${item.id_contagem_inventario}`
      : "MEDIA",
  );
  const [status, setStatus] = useState<"APROVADO" | "REJEITADO">("APROVADO");
  const [justificativa, setJustificativa] = useState(item.ajuste?.justificativa ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (status === "REJEITADO" && !justificativa.trim()) {
      mostrarAviso("Informe a justificativa para rejeitar o ajuste.", "cautela");
      return;
    }
    const individual = origem.startsWith("CONTAGEM:");
    setSalvando(true);
    try {
      const resultado = await decidirAjuste({
        id_inventario: inventarioId,
        id_produto: item.id_produto,
        origem: individual ? "CONTAGEM" : "MEDIA",
        id_contagem_inventario: individual ? Number(origem.split(":")[1]) : null,
        status,
        justificativa: justificativa.trim() || null,
      });
      if ("error" in resultado && resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Decisão registrada.", "sucesso");
      onSalvo();
    } catch {
      mostrarAviso("Não foi possível registrar a decisão.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  if (item.decidido) {
    if (!podeVerSistema) {
      return <span className="text-sm text-[#0f5132]">Decisão registrada</span>;
    }

    return (
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[#0f5132]">
          {item.origem_label ?? (item.origem === "MEDIA" ? "Média" : "Contagem")}
          {item.quantidade_final === null ? "" : ` · ${q(item.quantidade_final)}`}
        </span>
        {item.ajuste ? (
          <span
            className={
              item.ajuste.status === "APROVADO"
                ? "font-semibold text-[#0f5132]"
                : "font-semibold text-[#8a1c1c]"
            }
          >
            {item.ajuste.status_label}
            {item.ajuste.quantidade_contada === null
              ? ""
              : ` · ajuste ${q(item.ajuste.quantidade_contada)}`}
          </span>
        ) : (
          <span className="text-xs text-[#697077]">Sem ajuste</span>
        )}
        {item.ajuste?.justificativa && (
          <span className="text-xs text-[#697077]">{item.ajuste.justificativa}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={origem}
          onChange={(event) => setOrigem(event.target.value)}
          className="h-9 rounded-lg border border-[#c1c7cd] bg-white px-2 text-sm"
          aria-label={`Origem do ajuste de ${item.descricao}`}
        >
          <option value="MEDIA">{item.media === null ? "Média" : `Média (${q(item.media)})`}</option>
          {item.contagens.map((contagem) => (
            <option
              key={contagem.id_contagem_inventario}
              value={`CONTAGEM:${contagem.id_contagem_inventario}`}
            >
              {letra(funcionarios, contagem.id_funcionario)} — {contagem.funcionario} ({q(contagem.quantidade_contada)})
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "APROVADO" | "REJEITADO")}
          className="h-9 rounded-lg border border-[#c1c7cd] bg-white px-2 text-sm"
          aria-label={`Decisão de ${item.descricao}`}
        >
          <option value="APROVADO">Aprovar</option>
          <option value="REJEITADO">Rejeitar</option>
        </select>
        <input
          value={justificativa}
          onChange={(event) => setJustificativa(event.target.value)}
          placeholder={status === "REJEITADO" ? "Justificativa (obrigatória)" : "Justificativa (opcional)"}
          className="h-9 min-w-48 flex-1 rounded-lg border border-[#c1c7cd] px-2 text-sm"
          aria-label={`Justificativa de ${item.descricao}`}
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-9 rounded-lg border border-brand px-3 text-xs font-semibold text-brand transition-colors hover:bg-[rgba(27,153,86,0.06)] disabled:opacity-50"
        >
          {salvando ? "..." : "Registrar"}
        </button>
      </div>
      {!podeVerSistema && (
        <span className="text-xs text-[#8a5a00]">
          O saldo do sistema está oculto.
        </span>
      )}
    </div>
  );
}

export default function AprovacaoClient({ inventario }: { inventario: InventarioDetalhe }) {
  const router = useRouter();
  const mostrarAviso = useAviso();
  const [finalizando, setFinalizando] = useState(false);

  const pendentes = inventario.itens.filter((item) => !item.decidido).length;
  const decididos = inventario.itens.length - pendentes;
  const funcionarios = inventario.funcionariosContagem;
  const totalColunas =
    2 +
    (inventario.podeVerSistema ? 2 : 0) +
    Math.max(funcionarios.length, 1) +
    1;

  async function finalizar() {
    if (pendentes > 0) {
      mostrarAviso(`Ainda há ${pendentes} item(ns) sem decisão.`, "cautela");
      return;
    }
    setFinalizando(true);
    try {
      const resultado = await finalizarInventario(inventario.id_inventario);
      if ("error" in resultado && resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Inventário finalizado.", "sucesso");
      router.push(`/inventario/${inventario.id_inventario}`);
      router.refresh();
    } catch {
      mostrarAviso("Não foi possível finalizar o inventário.", "erro");
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-figma="InventarioAprovacao">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-white p-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-lg font-semibold text-ink">
            Aprovação do inventário
          </h2>
          <p className="m-0 text-sm text-[#697077]">
            {inventario.observacao} · {inventario.itens.length} item(ns) · {decididos} decidido(s)
          </p>
          {!inventario.podeVerSistema && (
            <p className="m-0 text-xs text-[#8a5a00]">
              Você não tem <code>estoque.ver_saldo</code>; os saldos do sistema não são exibidos.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            label="Finalizar inventário"
            onClick={finalizar}
            disabled={finalizando || pendentes > 0}
          />
          <Button
            label="Voltar"
            href={`/inventario/${inventario.id_inventario}`}
            variant="ghost"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand text-left text-white">
              <th className="px-3 py-2 font-display font-semibold">Código</th>
              <th className="px-3 py-2 font-display font-semibold">Produto</th>
              {inventario.podeVerSistema && (
                <th className="px-3 py-2 text-right font-display font-semibold">Sistema</th>
              )}
              {funcionarios.length === 0 ? (
                <th className="px-3 py-2 font-display font-semibold">Contagens</th>
              ) : (
                funcionarios.map((funcionario, indice) => (
                  <th
                    key={funcionario.id_funcionario}
                    title={funcionario.nome}
                    className="px-2 py-2 text-center font-display font-semibold"
                  >
                    {letraColuna(indice)}
                  </th>
                ))
              )}
              {inventario.podeVerSistema && (
                <th className="px-3 py-2 text-right font-display font-semibold">Média</th>
              )}
              <th className="px-3 py-2 font-display font-semibold">Decisão</th>
            </tr>
          </thead>
          <tbody>
            {inventario.itens.map((item, index) => (
              <tr
                key={item.id_item_inventario}
                className={index % 2 === 1 ? "bg-[#f8fafb]" : "bg-white"}
              >
                <td className="px-3 py-2 font-mono text-xs text-[#697077]">{item.codigo}</td>
                <td className="px-3 py-2">{item.descricao}</td>
                {inventario.podeVerSistema && (
                  <td className="px-3 py-2 text-right">{q(item.quantidade_sistema)}</td>
                )}
                {funcionarios.length === 0 ? (
                  <td className="px-3 py-2 text-xs text-[#8a1c1c]">Sem contagem</td>
                ) : (
                  funcionarios.map((funcionario) => {
                    const contagem = item.contagens.find(
                      (c) => c.id_funcionario === funcionario.id_funcionario,
                    );
                    return (
                      <td
                        key={funcionario.id_funcionario}
                        className="px-2 py-2 text-center"
                      >
                        {contagem ? q(contagem.quantidade_contada) : ""}
                      </td>
                    );
                  })
                )}
                {inventario.podeVerSistema && (
                  <td className="px-3 py-2 text-right">{q(item.media)}</td>
                )}
                <td className="px-3 py-2">
                  <LinhaDecisao
                    item={item}
                    inventarioId={inventario.id_inventario}
                    podeVerSistema={inventario.podeVerSistema}
                    funcionarios={funcionarios}
                    onSalvo={() => router.refresh()}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          {funcionarios.length > 0 && (
            <tfoot>
              <tr>
                <td
                  colSpan={totalColunas}
                  className="border-t border-border bg-[#f8fafb] px-3 py-2 text-xs text-[#4a4f55]"
                >
                  <span className="font-semibold">Legenda:</span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {funcionarios.map((funcionario, indice) => (
                      <span key={funcionario.id_funcionario}>
                        {letraColuna(indice)} — {funcionario.nome}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
