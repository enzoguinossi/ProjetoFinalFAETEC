"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import { formatarCodigo, formatarQuantidade } from "@/lib/formatar";
import {
  desmembrarProduto,
  previewDesmembramento,
  type DesmembramentoPreview,
  type ResultadoDesmembramentoProduto,
} from "../actions";

type Sucesso = Extract<ResultadoDesmembramentoProduto, { success: true }>;

interface Props {
  idProduto: number;
  onClose: () => void;
  /** Chamado depois que a operação foi gravada (para a lista recarregar). */
  onSuccess?: () => void;
}

const rotuloCls = "font-sans text-xs leading-4 text-[#697077]";
const valorCls = "font-sans text-sm leading-5 text-ink-strong";
const celulaCls = "px-3 py-2 font-sans text-sm text-ink";
const cabecalhoCls = "px-3 py-2 font-sans text-sm font-semibold";

/**
 * Desmembra um produto composto: o modal carrega a prévia no servidor (produto
 * e insumos ativos), calcula os totais na tela apenas como apoio e envia a
 * quantidade para a Server Action. Nenhuma regra de saldo/nota mora aqui.
 */
export default function DesmembrarProdutoModal({
  idProduto,
  onClose,
  onSuccess,
}: Props) {
  const mostrarAviso = useAviso();
  const [preview, setPreview] = useState<DesmembramentoPreview | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [quantidade, setQuantidade] = useState("1");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Sucesso | null>(null);
  const enviandoRef = useRef(false);

  useEffect(() => {
    let ativo = true;

    previewDesmembramento(idProduto)
      .then((dados) => {
        if (!ativo) return;
        if ("error" in dados) setErro(dados.error);
        else setPreview(dados);
      })
      .catch(() => {
        if (ativo) setErro("Não foi possível carregar os dados do produto.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [idProduto]);

  const qtd = Number(quantidade);
  const quantidadeValida = Number.isFinite(qtd) && qtd > 0;
  const insuficiente =
    preview !== null && quantidadeValida && qtd > preview.produto.disponivel;

  async function confirmar() {
    if (!preview || !quantidadeValida || enviandoRef.current) return;

    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const formData = new FormData();
      formData.set("id_produto", String(preview.produto.id_produto));
      formData.set("quantidade", String(qtd));

      const resposta = await desmembrarProduto(formData);
      if ("error" in resposta) {
        setErro(resposta.error);
        return;
      }

      setResultado(resposta);
      mostrarAviso(
        `Desmembramento registrado: saída ${resposta.notaSaida.codigo} e entrada ${resposta.notaEntrada.codigo}.`,
        "sucesso",
      );
      onSuccess?.();
    } catch {
      setErro("Erro ao desmembrar o produto. Tente novamente.");
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Desmembrar produto"
      width="760px"
    >
      {carregando ? (
        <div className="py-10 text-center font-sans text-sm text-[#697077]">
          Carregando...
        </div>
      ) : resultado ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[rgba(27,153,86,0.25)] bg-[rgba(27,153,86,0.06)] p-4">
            <p className="m-0 font-sans text-sm font-semibold text-ink-strong">
              Desmembramento registrado.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <span className={valorCls}>
                Nota de saída: {resultado.notaSaida.codigo}
              </span>
              <span className={valorCls}>
                Nota de entrada: {resultado.notaEntrada.codigo}
              </span>
            </div>
          </div>

          {resultado.aviso && (
            <p className="m-0 rounded-lg border border-[rgba(219,142,0,0.35)] bg-[rgba(219,142,0,0.08)] px-3 py-2 font-sans text-sm text-[#7a5200]">
              {resultado.aviso}
            </p>
          )}

          <div className="flex justify-end gap-2.5">
            <Button label="Fechar" variant="cancel" onClick={onClose} />
          </div>
        </div>
      ) : erro && !preview ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 rounded-lg border border-[rgba(195,42,42,0.25)] bg-[rgba(195,42,42,0.06)] px-3 py-2 font-sans text-sm text-[#a32222]">
            {erro}
          </p>
          <div className="flex justify-end">
            <Button label="Fechar" variant="cancel" onClick={onClose} />
          </div>
        </div>
      ) : preview ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className={rotuloCls}>Produto</span>
              <span className="font-display text-lg font-[590] text-ink-strong">
                {preview.produto.descricao}
              </span>
              <span className="font-sans text-xs text-[#697077]">
                Código {formatarCodigo(preview.produto.id_produto)}
              </span>
            </div>
            <div className="flex items-end gap-5">
              <div className="flex flex-col">
                <span className={rotuloCls}>Saldo</span>
                <span className={valorCls}>
                  {formatarQuantidade(preview.produto.saldo)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className={rotuloCls}>Reservado</span>
                <span className={valorCls}>
                  {formatarQuantidade(preview.produto.saldo_reservado)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className={rotuloCls}>Disponível</span>
                <span className={valorCls}>
                  {formatarQuantidade(preview.produto.disponivel)}
                </span>
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className={rotuloCls}>Quantidade a desmembrar</span>
            <input
              type="number"
              min="0"
              step="any"
              value={quantidade}
              onChange={(event) => setQuantidade(event.target.value)}
              disabled={enviando}
              className="h-10 w-40 rounded-lg border border-[#c1c7cd] bg-white px-3 font-sans text-sm text-ink outline-none transition-[border-color] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)] disabled:opacity-60"
            />
          </label>

          {!quantidadeValida && (
            <p className="m-0 font-sans text-sm text-[#a32222]">
              Informe uma quantidade maior que zero.
            </p>
          )}

          {insuficiente && (
            <p className="m-0 rounded-lg border border-[rgba(219,142,0,0.35)] bg-[rgba(219,142,0,0.08)] px-3 py-2 font-sans text-sm text-[#7a5200]">
              O saldo disponível é menor que a quantidade informada. O saldo
              ficará negativo; a operação é permitida (RN001).
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-brand text-white">
                  <th className={`${cabecalhoCls} text-left`}>Insumo</th>
                  <th className={`${cabecalhoCls} text-right`}>Por unidade</th>
                  <th className={`${cabecalhoCls} text-right`}>Total</th>
                  <th className={`${cabecalhoCls} text-right`}>Saldo atual</th>
                  <th className={`${cabecalhoCls} text-right`}>Novo saldo</th>
                </tr>
              </thead>
              <tbody>
                {preview.insumos.map((insumo, indice) => {
                  const total = quantidadeValida
                    ? qtd * insumo.quantidade_por_unidade
                    : 0;
                  return (
                    <tr
                      key={insumo.id_produto}
                      className={indice % 2 === 1 ? "bg-table-alt!" : "bg-white"}
                    >
                      <td className={celulaCls}>{insumo.descricao}</td>
                      <td className={`${celulaCls} text-right tabular-nums`}>
                        {formatarQuantidade(insumo.quantidade_por_unidade)}
                      </td>
                      <td className={`${celulaCls} text-right tabular-nums`}>
                        {formatarQuantidade(total)}
                      </td>
                      <td className={`${celulaCls} text-right tabular-nums`}>
                        {formatarQuantidade(insumo.saldo)}
                      </td>
                      <td className={`${celulaCls} text-right tabular-nums`}>
                        {formatarQuantidade(insumo.saldo + total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {erro && (
            <p className="m-0 rounded-lg border border-[rgba(195,42,42,0.25)] bg-[rgba(195,42,42,0.06)] px-3 py-2 font-sans text-sm text-[#a32222]">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2.5">
            <Button label="Cancelar" variant="cancel" onClick={onClose} />
            <Button
              label={enviando ? "Desmembrando..." : "Confirmar"}
              onClick={() => void confirmar()}
              disabled={!quantidadeValida || enviando}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
