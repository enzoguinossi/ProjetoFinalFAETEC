"use client";

import { useState } from "react";
import { UFS } from "@/lib/uf";
import type { EnderecoCep, ResultadoCep } from "@/services/cep";

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

const inputStyle = {
  height: 40,
  padding: "0 16px",
  border: "1px solid #d9d9d9",
  borderRadius: 8,
  fontFamily: "Inter,sans-serif",
  fontSize: "1rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

const labelStyle = {
  fontFamily: "Inter,sans-serif",
  fontSize: "1rem",
  color: "#1e1e1e",
};

const colStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "8px",
  flex: 1,
};

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
  const [erro, setErro] = useState("");

  function set<K extends keyof EnderecoValue>(key: K, v: EnderecoValue[K]) {
    setValue((prev) => ({ ...prev, [key]: v }));
  }

  async function buscarCep() {
    const digitos = value.cep.replace(/\D/g, "");
    if (digitos.length !== 8) {
      setErro("CEP deve conter 8 dígitos.");
      return;
    }
    setBuscando(true);
    setErro("");
    try {
      const result = await onLookup(digitos);
      if ("error" in result) {
        setErro(result.error);
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
      setErro("Não foi possível consultar o CEP.");
    } finally {
      setBuscando(false);
    }
  }

  const text = (key: keyof EnderecoValue, requiredField = false) =>
    disabled ? (
      <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{value[key] || "—"}</p>
    ) : (
      <input
        name={key}
        required={requiredField}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        style={inputStyle}
      />
    );

  return (
    <>
      {/* CEP + UF */}
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ ...colStyle, flex: 2 }}>
          <label style={labelStyle}>CEP</label>
          {disabled ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{value.cep || "—"}</p>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                name="cep"
                value={value.cep}
                onChange={(e) => set("cep", e.target.value)}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={buscarCep}
                disabled={buscando}
                title="Buscar endereço pelo CEP"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  minWidth: 40, height: 40, border: "1px solid #d9d9d9", borderRadius: 8,
                  background: "#fff", cursor: buscando ? "wait" : "pointer", color: "#1b9956",
                  flexShrink: 0, opacity: buscando ? 0.6 : 1,
                }}
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
        <div style={{ ...colStyle, flex: 1 }}>
          <label style={labelStyle}>UF</label>
          {disabled ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{value.uf || "—"}</p>
          ) : (
            <select
              name="uf"
              value={value.uf}
              onChange={(e) => set("uf", e.target.value)}
              style={{ ...inputStyle, background: "#fff" }}
            >
              <option value="">Selecione...</option>
              {UFS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      {erro && (
        <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#ff383c" }}>
          {erro}
        </span>
      )}

      {/* Logradouro */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={labelStyle}>Logradouro</label>
        {text("logradouro", required)}
      </div>

      {/* Número + Complemento */}
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={colStyle}>
          <label style={labelStyle}>Número</label>
          {text("numero")}
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Complemento</label>
          {text("complemento")}
        </div>
      </div>

      {/* Bairro + Cidade */}
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={colStyle}>
          <label style={labelStyle}>Bairro</label>
          {text("bairro")}
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Cidade</label>
          {text("cidade", required)}
        </div>
      </div>

      {/* Coordenadas */}
      {showCoords && (
        <div style={{ display: "flex", gap: "1rem" }}>
          <div style={colStyle}>
            <label style={labelStyle}>Latitude</label>
            {disabled ? (
              <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{value.latitude || "—"}</p>
            ) : (
              <input name="latitude" type="number" step="any" value={value.latitude}
                onChange={(e) => set("latitude", e.target.value)} style={inputStyle} />
            )}
          </div>
          <div style={colStyle}>
            <label style={labelStyle}>Longitude</label>
            {disabled ? (
              <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{value.longitude || "—"}</p>
            ) : (
              <input name="longitude" type="number" step="any" value={value.longitude}
                onChange={(e) => set("longitude", e.target.value)} style={inputStyle} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
