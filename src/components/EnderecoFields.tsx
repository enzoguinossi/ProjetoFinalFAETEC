"use client";

import { useState } from "react";
import { UFS } from "@/lib/uf";
import { CEP_MAX_CARACTERES, formatarCep, validarCep } from "@/lib/cep";
import type { EnderecoCep, ResultadoCep } from "@/services/cep";
import { useAviso } from "@/components/AvisoProvider";

export type EnderecoValue = {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

export type EnderecoInitial = Partial<{
  [K in keyof EnderecoValue]: EnderecoValue[K] | null;
}>;

interface Props {
  initial?: EnderecoInitial | null;
  /** Sugestão externa (ex.: consulta de CNPJ) mesclada nos campos quando chega. */
  sugestao?: EnderecoInitial | null;
  disabled?: boolean;
  required?: boolean;
  onLookup: (cep: string) => Promise<ResultadoCep>;
}

const CAMPOS_SUGESTAO: (keyof EnderecoValue)[] = [
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
];

/** Número e complemento do usuário nunca são sobrescritos por uma consulta. */
const CAMPOS_PRESERVADOS: (keyof EnderecoValue)[] = ["numero", "complemento"];

const INPUT_CLASS =
  "h-10 w-full box-border rounded-lg border border-border-input bg-white px-4 font-sans text-base outline-none transition-[border-color] duration-[120ms] focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";
const roClass =
  "flex h-10 w-full items-center rounded-lg border border-border-input px-4 font-sans text-base";
const colClass = "flex flex-1 flex-col gap-1.5";
const labelClass = "font-sans text-sm font-medium leading-5 text-ink-strong";

function Campo({
  label,
  className = colClass,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function toValue(initial?: EnderecoInitial | null): EnderecoValue {
  return {
    logradouro: initial?.logradouro ?? "",
    numero: initial?.numero ?? "",
    complemento: initial?.complemento ?? "",
    bairro: initial?.bairro ?? "",
    cidade: initial?.cidade ?? "",
    uf: initial?.uf ?? "",
    cep: formatarCep(initial?.cep ?? ""),
  };
}

export default function EnderecoFields({
  initial,
  sugestao = null,
  disabled = false,
  required = false,
  onLookup,
}: Props) {
  const [value, setValue] = useState<EnderecoValue>(toValue(initial));
  const [buscando, setBuscando] = useState(false);
  const [preenchido, setPreenchido] = useState(false);
  const [sugestaoAplicada, setSugestaoAplicada] = useState<EnderecoInitial | null>(null);
  const mostrarAviso = useAviso();

  // Ajuste de estado na renderização quando chega uma nova sugestão (ex.: consulta de CNPJ):
  // mescla os campos informados; número e complemento só entram se estiverem vazios.
  if (sugestao !== sugestaoAplicada) {
    setSugestaoAplicada(sugestao);
    if (sugestao) {
      setValue((prev) => {
        const proximo = { ...prev };
        for (const campo of CAMPOS_SUGESTAO) {
          const sugerido = sugestao[campo];
          if (sugerido == null) continue;
          if (CAMPOS_PRESERVADOS.includes(campo) && prev[campo]) continue;
          proximo[campo] = campo === "cep" ? formatarCep(String(sugerido)) : sugerido;
        }
        return proximo;
      });
    }
  }

  function set<K extends keyof EnderecoValue>(key: K, v: EnderecoValue[K]) {
    setValue((prev) => ({ ...prev, [key]: v }));
  }

  async function buscarCep() {
    const validacao = validarCep(value.cep);
    if (!validacao.ok) {
      mostrarAviso(validacao.erro, "erro");
      return;
    }
    setBuscando(true);
    try {
      const result = await onLookup(validacao.cep);
      if ("error" in result) {
        mostrarAviso(result.error, "erro");
        return;
      }
      const e: EnderecoCep = result.endereco;
      setValue((prev) => ({
        ...prev,
        cep: formatarCep(e.cep),
        logradouro: e.logradouro || prev.logradouro,
        bairro: e.bairro || prev.bairro,
        cidade: e.cidade || prev.cidade,
        uf: e.uf || prev.uf,
      }));
      setPreenchido(true);
    } catch {
      mostrarAviso("Não foi possível consultar o CEP.", "erro");
    } finally {
      setBuscando(false);
    }
  }

  const text = (key: keyof EnderecoValue, requiredField = false) =>
    disabled ? (
      <p className={roClass}>{value[key] || "—"}</p>
    ) : (
      <input
        name={key}
        required={requiredField}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        className={INPUT_CLASS}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <Campo label="CEP" className={`${colClass} flex-[2]`}>
          {disabled ? (
            <p className={roClass}>{value.cep || "—"}</p>
          ) : (
            <div className="flex gap-2">
              <input
                name="cep"
                value={value.cep}
                onChange={(e) => {
                  set("cep", formatarCep(e.target.value));
                  setPreenchido(false);
                }}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={CEP_MAX_CARACTERES}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={buscarCep}
                disabled={buscando}
                title="Buscar endereço pelo CEP"
                className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border-input bg-white px-3 font-sans text-sm text-brand transition-colors hover:bg-[rgba(27,153,86,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-wait disabled:opacity-60"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>
          )}
        </Campo>
        <Campo label="UF" className={`${colClass} flex-1`}>
          {disabled ? (
            <p className={roClass}>{value.uf || "—"}</p>
          ) : (
            <select
              name="uf"
              value={value.uf}
              onChange={(e) => set("uf", e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer`}
            >
              <option value="">Selecione...</option>
              {UFS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
        </Campo>
      </div>

      {preenchido && !disabled && (
        <span className="-mt-2 font-sans text-xs text-[#697077]">
          Endereço preenchido.
        </span>
      )}

      <Campo label="Logradouro">{text("logradouro", required)}</Campo>

      <div className="flex gap-4">
        <Campo label="Número">{text("numero")}</Campo>
        <Campo label="Complemento">{text("complemento")}</Campo>
      </div>

      <div className="flex gap-4">
        <Campo label="Bairro">{text("bairro")}</Campo>
        <Campo label="Cidade">{text("cidade", required)}</Campo>
      </div>
    </div>
  );
}
