"use client";

import { useState } from "react";
import { UFS } from "@/lib/uf";
import type { EnderecoCep, ResultadoCep } from "@/services/cep";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

export type EnderecoValue = {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude: string;
  longitude: string;
};

type EnderecoInitial = Partial<{
  [K in keyof EnderecoValue]: EnderecoValue[K] | null;
}>;

interface Props {
  initial?: EnderecoInitial | null;
  disabled?: boolean;
  required?: boolean;
  showCoords?: boolean;
  onLookup: (cep: string) => Promise<ResultadoCep>;
}

const roClass = "flex h-10 w-full items-center rounded-lg border border-border-input px-4 font-sans text-base";
const colClass = "flex flex-1 flex-col gap-2";

function toValue(initial?: EnderecoInitial | null): EnderecoValue {
  return {
    logradouro: initial?.logradouro ?? "",
    numero: initial?.numero ?? "",
    complemento: initial?.complemento ?? "",
    bairro: initial?.bairro ?? "",
    cidade: initial?.cidade ?? "",
    uf: initial?.uf ?? "",
    cep: initial?.cep ?? "",
    latitude: initial?.latitude ?? "",
    longitude: initial?.longitude ?? "",
  };
}

export default function EnderecoFields({
  initial,
  disabled = false,
  required = false,
  showCoords = false,
  onLookup,
}: Props) {
  const [value, setValue] = useState<EnderecoValue>(toValue(initial));
  const [buscando, setBuscando] = useState(false);
  const mostrarAviso = useAviso();

  function set<K extends keyof EnderecoValue>(key: K, v: EnderecoValue[K]) {
    setValue((prev) => ({ ...prev, [key]: v }));
  }

  async function buscarCep() {
    const digitos = value.cep.replace(/\D/g, "");
    if (digitos.length !== 8) {
      mostrarAviso("CEP deve conter 8 dígitos.", "erro");
      return;
    }
    setBuscando(true);
    try {
      const result = await onLookup(digitos);
      if ("error" in result) {
        mostrarAviso(result.error, "erro");
        return;
      }
      const e: EnderecoCep = result.endereco;
      setValue((prev) => ({
        ...prev,
        cep: e.cep,
        logradouro: e.logradouro || prev.logradouro,
        bairro: e.bairro || prev.bairro,
        cidade: e.cidade || prev.cidade,
        uf: e.uf || prev.uf,
      }));
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
        className={ui.input}
      />
    );

  return (
    <>
      {/* CEP + UF */}
      <div className="flex gap-4">
        <div className={`${colClass} flex-[2]`}>
          <label className={ui.label}>CEP</label>
          {disabled ? (
            <p className={roClass}>{value.cep || "—"}</p>
          ) : (
            <div className="flex gap-2">
              <input
                name="cep"
                value={value.cep}
                onChange={(e) => set("cep", e.target.value)}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                className={ui.input}
              />
              <button
                type="button"
                onClick={buscarCep}
                disabled={buscando}
                title="Buscar endereço pelo CEP"
                className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-border-input bg-white text-brand cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {buscando ? "…" : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
        <div className={`${colClass} flex-1`}>
          <label className={ui.label}>UF</label>
          {disabled ? (
            <p className={roClass}>{value.uf || "—"}</p>
          ) : (
            <select
              name="uf"
              value={value.uf}
              onChange={(e) => set("uf", e.target.value)}
              className={ui.select}
            >
              <option value="">Selecione...</option>
              {UFS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      {/* Logradouro */}
      <div className="flex flex-col gap-2">
        <label className={ui.label}>Logradouro</label>
        {text("logradouro", required)}
      </div>

      {/* Número + Complemento */}
      <div className="flex gap-4">
        <div className={colClass}>
          <label className={ui.label}>Número</label>
          {text("numero")}
        </div>
        <div className={colClass}>
          <label className={ui.label}>Complemento</label>
          {text("complemento")}
        </div>
      </div>

      {/* Bairro + Cidade */}
      <div className="flex gap-4">
        <div className={colClass}>
          <label className={ui.label}>Bairro</label>
          {text("bairro")}
        </div>
        <div className={colClass}>
          <label className={ui.label}>Cidade</label>
          {text("cidade", required)}
        </div>
      </div>

      {/* Coordenadas */}
      {showCoords && (
        <div className="flex gap-4">
          <div className={colClass}>
            <label className={ui.label}>Latitude</label>
            {disabled ? (
              <p className={roClass}>{value.latitude || "—"}</p>
            ) : (
              <input name="latitude" type="number" step="any" value={value.latitude}
                onChange={(e) => set("latitude", e.target.value)} className={ui.input} />
            )}
          </div>
          <div className={colClass}>
            <label className={ui.label}>Longitude</label>
            {disabled ? (
              <p className={roClass}>{value.longitude || "—"}</p>
            ) : (
              <input name="longitude" type="number" step="any" value={value.longitude}
                onChange={(e) => set("longitude", e.target.value)} className={ui.input} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
