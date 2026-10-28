"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import {
  cancelarInventario,
  fecharContagem,
  registrarContagem,
  type InventarioDetalhe,
  type InventarioItemRow,
} from "../actions";

function formatarData(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("pt-BR");
}

function formatarQuantidade(valor: number | null): string {
  if (valor === null) return "—";
  return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** A, B, ..., Z, AA, AB... para as colunas de contagem. */
function letraColuna(indice: number): string {
  let n = indice;
  let letra = "";
  while (n >= 0) {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  }
  return letra;
}

const statusCls: Record<string, string> = {
  ABERTO: "bg-[#e8f0fe] text-[#001d6c]",
  EM_CONTAGEM: "bg-[#fff4e5] text-[#7a4100]",
  AGUARDANDO_APROVACAO: "bg-[#f3e8ff] text-[#5b1a8a]",
  FINALIZADO: "bg-[#e7f6ec] text-[#0f5132]",
  CANCELADO: "bg-[#f2f4f8] text-[#4a4f55]",
};

function ContagemCelula({
  item,
  inventarioId,
  podeContar,
  onSalvo,
  onErro,
}: {
  item: InventarioItemRow;
  inventarioId: number;
  podeContar: boolean;
  onSalvo: () => void;
  onErro: (mensagem: string) => void;
}) {
  const [valor, setValor] = useState(
    item.minha_contagem ? String(item.minha_contagem.quantidade_contada) : "",
  );
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!valor.trim() || Number.isNaN(Number(valor)) || Number(valor) < 0) {
      onErro("Informe uma contagem válida (zero ou positiva).");
      return;
    }
    setSalvando(true);
    try {
      const resultado = await registrarContagem({
        id_inventario: inventarioId,
        id_item_inventario: item.id_item_inventario,
        quantidade: Number(valor),
      });
      // O id do inventário é preenchido pelo pai via closure para não expor
      // outro estado no componente da linha.
      if ("error" in resultado && resultado.error) {
        onErro(resultado.error);
        return;
      }
      onSalvo();
    } catch {
      onErro("Não foi possível registrar a contagem.");
    } finally {
      setSalvando(false);
    }
  }

  if (!podeContar) {
    return (
      <span className="text-sm text-[#697077]">
        {item.minha_contagem
          ? formatarQuantidade(item.minha_contagem.quantidade_contada)
          : "—"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        step="1"
        value={valor}
        onChange={(event) => setValor(event.target.value)}
        className="h-9 w-24 rounded-lg border border-[#c1c7cd] px-2 font-sans text-sm text-ink outline-none focus:border-brand"
        aria-label={`Contagem de ${item.descricao}`}
      />
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="h-9 rounded-lg border border-brand px-2 text-xs font-semibold text-brand transition-colors hover:bg-[rgba(27,153,86,0.06)] disabled:opacity-50"
      >
        {salvando ? "..." : "Salvar"}
      </button>
    </div>
  );
}

export default function InventarioDetalheClient({
  inventario,
}: {
  inventario: InventarioDetalhe;
}) {
  const router = useRouter();
  const mostrarAviso = useAviso();
  const [cancelando, setCancelando] = useState(false);
  const [processando, setProcessando] = useState(false);

  const faltando = inventario.total - inventario.contados;
  const funcionarios = inventario.funcionariosContagem;
  const totalColunas =
    2 +
    (inventario.podeVerSistema ? 1 : 0) +
    Math.max(funcionarios.length, 1) +
    2;

  async function fechar() {
    if (faltando > 0) {
      mostrarAviso(
        `Ainda há ${faltando} item(ns) sem contagem. Todos precisam ser contados.`,
        "cautela",
      );
      return;
    }
    setProcessando(true);
    try {
      const resultado = await fecharContagem(inventario.id_inventario);
      if ("error" in resultado && resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Contagem fechada. Inventário aguardando aprovação.", "sucesso");
      router.refresh();
    } catch {
      mostrarAviso("Não foi possível fechar a contagem.", "erro");
    } finally {
      setProcessando(false);
    }
  }

  async function cancelar() {
    setProcessando(true);
    try {
      const resultado = await cancelarInventario(inventario.id_inventario);
      if ("error" in resultado && resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Inventário cancelado. O histórico de contagens foi preservado.", "sucesso");
      setCancelando(false);
      router.refresh();
    } catch {
      mostrarAviso("Não foi possível cancelar o inventário.", "erro");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-figma="InventarioDetalhe">
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 font-display text-lg font-semibold text-ink">
                {inventario.observacao}
              </h2>
              <span
                className={`inline-flex rounded-full px-3 py-1 font-sans text-xs font-semibold ${
                  statusCls[inventario.status] ?? "bg-[#f2f4f8] text-ink"
                }`}
              >
                {inventario.status_label}
              </span>
            </div>
            <p className="m-0 text-sm text-[#697077]">
              Aberto em {formatarData(inventario.data_inicio)} por {inventario.abertura}
              {inventario.data_fim ? ` · Fechado em ${formatarData(inventario.data_fim)}` : ""}
              {inventario.aprovacao ? ` · Aprovador: ${inventario.aprovacao}` : ""}
            </p>
            <p className="m-0 text-sm text-[#697077]">
              Progresso: {inventario.contados}/{inventario.total} item(ns) contado(s)
              {inventario.contagem_cega ? " · Contagem cega" : ""}
            </p>
            {!inventario.podeVerSistema && (
              <p className="m-0 text-xs text-[#8a5a00]">
                O saldo do sistema está oculto porque você não tem <code>estoque.ver_saldo</code>.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {inventario.podeFechar && (
              <Button
                label="Fechar contagem"
                onClick={fechar}
                disabled={processando || faltando > 0}
              />
            )}
            {inventario.podeAprovar && (
              <Button
                label="Aprovar ajustes"
                href={`/inventario/${inventario.id_inventario}/aprovar`}
              />
            )}
            {inventario.podeGerarLista && (
              <Button
                label="Lista de contagem"
                href={`/inventario/${inventario.id_inventario}/lista`}
                variant="ghost"
              />
            )}
            {inventario.podeGerarRelatorio && (
              <Button
                label="Relatório"
                href={`/inventario/${inventario.id_inventario}/relatorio`}
                variant="ghost"
              />
            )}
            {inventario.podeCancelar && (
              <Button
                label="Cancelar"
                variant="cancel"
                onClick={() => setCancelando(true)}
                disabled={processando}
              />
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table
          className="w-full border-collapse text-sm"
          style={{
            minWidth: `${Math.max(
              760,
              520 +
                Math.max(funcionarios.length, 1) * 120 +
                (inventario.podeVerSistema ? 90 : 0),
            )}px`,
          }}
        >
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
                    className={`px-2 py-2 text-center font-display font-semibold ${
                      funcionario.id_funcionario === inventario.id_funcionario
                        ? "bg-[#15844a]"
                        : ""
                    }`}
                  >
                    {letraColuna(indice)}
                  </th>
                ))
              )}
              <th className="px-3 py-2 text-right font-display font-semibold">Média</th>
              <th className="px-3 py-2 font-display font-semibold">Minha contagem</th>
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
                  <td className="px-3 py-2 text-right">
                    {formatarQuantidade(item.quantidade_sistema)}
                  </td>
                )}
                {funcionarios.length === 0 ? (
                  <td className="px-3 py-2 text-xs text-[#8a1c1c]">Sem contagem</td>
                ) : (
                  funcionarios.map((funcionario) => {
                    const contagem = item.contagens.find(
                      (c) => c.id_funcionario === funcionario.id_funcionario,
                    );
                    const atual =
                      funcionario.id_funcionario === inventario.id_funcionario;
                    return (
                      <td
                        key={funcionario.id_funcionario}
                        className={`px-2 py-2 text-center ${atual ? "bg-[#f0faf4]" : ""}`}
                      >
                        {contagem
                          ? formatarQuantidade(contagem.quantidade_contada)
                          : ""}
                      </td>
                    );
                  })
                )}
                <td className="px-3 py-2 text-right">
                  {item.contagens.length > 0 ? formatarQuantidade(item.media) : "—"}
                </td>
                <td className="px-3 py-2">
                  {inventario.podeContar ? (
                    <ContagemCelula
                      key={`${item.id_item_inventario}-${item.minha_contagem?.id_contagem_inventario ?? "new"}-${item.minha_contagem?.data_contagem ?? ""}`}
                      item={item}
                      inventarioId={inventario.id_inventario}
                      podeContar={inventario.podeContar}
                      onSalvo={() => router.refresh()}
                      onErro={(mensagem) => mostrarAviso(mensagem, "erro")}
                    />
                  ) : (
                    <span className="text-sm text-[#697077]">
                      {item.minha_contagem
                        ? formatarQuantidade(item.minha_contagem.quantidade_contada)
                        : "—"}
                    </span>
                  )}
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

      <ConfirmDialog
        open={cancelando}
        onClose={() => setCancelando(false)}
        onConfirm={cancelar}
        title="Cancelar inventário"
        message="As contagens serão preservadas, mas o inventário não poderá mais ser usado para ajuste. Deseja cancelar?"
        confirmLabel="Cancelar inventário"
        loading={processando}
      />
    </div>
  );
}
