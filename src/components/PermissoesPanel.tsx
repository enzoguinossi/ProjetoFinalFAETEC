"use client";

import { useMemo } from "react";

export interface PermissaoOption {
  id_permissao: number;
  nome: string;
  descricao: string | null;
}

export interface GrupoPermissoes {
  prefixo: string;
  permissoes: PermissaoOption[];
}

interface Props {
  grupos: GrupoPermissoes[];
  selecionadas: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  tituloDisponiveis?: string;
  tituloSelecionadas?: string;
  /** Renderiza o botão + slot de ações (ex.: "Aplicar perfil"). */
  acoes?: React.ReactNode;
}

const cardStyle = {
  border: "1px solid #e2e2e2",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  maxHeight: 320,
  overflowY: "auto" as const,
  minHeight: 200,
};

const labelStyle = {
  fontFamily: "Inter,sans-serif",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#21272a",
  marginBottom: 6,
} as const;

export default function PermissoesPanel({
  grupos,
  selecionadas,
  onChange,
  disabled = false,
  tituloDisponiveis = "Disponíveis",
  tituloSelecionadas = "Selecionadas",
  acoes,
}: Props) {
  const itemStyle = (selected: boolean) => ({
    padding: "6px 10px",
    borderRadius: 8,
    fontFamily: "Inter,sans-serif",
    fontSize: "0.8125rem",
    cursor: disabled ? "default" : "pointer",
    background: selected ? "#e7f6ee" : "transparent",
    color: selected ? "#0f7a44" : "#21272a",
    border: "1px solid transparent",
    textAlign: "left" as const,
  });

  const todasDisponiveis = useMemo(
    () => grupos.flatMap((g) => g.permissoes.map((p) => p.nome)),
    [grupos],
  );
  const set = new Set(todasDisponiveis);

  function alternar(nome: string) {
    if (disabled) return;
    onChange(
      selecionadas.includes(nome)
        ? selecionadas.filter((n) => n !== nome)
        : [...selecionadas, nome],
    );
  }

  const validas = selecionadas.filter((n) => set.has(n));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontFamily: '"SF Pro","Segoe UI",sans-serif', fontSize: "1.125rem", fontWeight: 590, margin: 0, color: "#1e1e1e" }}>
          Permissões
        </h3>
        {acoes}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Disponíveis */}
        <div>
          <p style={labelStyle}>{tituloDisponiveis}</p>
          <div style={cardStyle}>
            {grupos.map((g) => (
              <div key={g.prefixo} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa0a6", margin: "4px 0" }}>
                  {g.prefixo}
                </span>
                {g.permissoes
                  .filter((p) => !validas.includes(p.nome))
                  .map((p) => (
                    <button
                      key={p.nome}
                      type="button"
                      style={itemStyle(false)}
                      onClick={() => alternar(p.nome)}
                      disabled={disabled}
                      title={p.descricao ?? p.nome}
                    >
                      {p.nome}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>

        {/* Selecionadas */}
        <div>
          <p style={labelStyle}>{tituloSelecionadas}</p>
          <div style={cardStyle}>
            {validas.length === 0 && (
              <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#9aa0a6" }}>
                Nenhuma permissão.
              </span>
            )}
            {[...validas].sort().map((nome) => (
              <button
                key={nome}
                type="button"
                style={itemStyle(true)}
                onClick={() => alternar(nome)}
                disabled={disabled}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
