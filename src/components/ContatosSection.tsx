"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import EmailForm from "@/components/EmailForm";
import TelefoneForm from "@/components/TelefoneForm";
import Button from "@/components/Button";
import type { TipoTelefone } from "@/types";

export type EmailEntry = { endereco: string; principal: boolean };
export type TelefoneEntry = { numero: string; tipo: TipoTelefone; principal: boolean };

interface Props {
  emails: EmailEntry[];
  telefones: TelefoneEntry[];
  onEmailsChange: (next: EmailEntry[]) => void;
  onTelefonesChange: (next: TelefoneEntry[]) => void;
  disabled?: boolean;
}

const TIPO_LABEL: Record<TipoTelefone, string> = {
  CELULAR: "Celular",
  FIXO: "Fixo",
  COMERCIAL: "Comercial",
};

const sectionTitle = {
  fontFamily: '"SF Pro", "Segoe UI", sans-serif',
  fontSize: "1.125rem",
  fontWeight: 590,
  letterSpacing: "-0.028125rem",
  color: "#1e1e1e",
  margin: 0,
} as const;

const emailColumns: Column<EmailEntry>[] = [
  { key: "endereco", label: "E-mail", width: "3fr" },
  { key: "principal", label: "Principal", width: "1fr", render: (v) => (v ? "Sim" : "—") },
];

const telefoneColumns: Column<TelefoneEntry>[] = [
  { key: "numero", label: "Número", width: "2fr" },
  { key: "tipo", label: "Tipo", width: "1.5fr", render: (v) => TIPO_LABEL[v as TipoTelefone] ?? String(v) },
  { key: "principal", label: "Principal", width: "1fr", render: (v) => (v ? "Sim" : "—") },
];

function ordenar<T extends { principal: boolean }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.principal) - Number(a.principal));
}

const novoIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function ContatosSection({
  emails,
  telefones,
  onEmailsChange,
  onTelefonesChange,
  disabled = false,
}: Props) {
  const [emailModal, setEmailModal] = useState(false);
  const [emailIdx, setEmailIdx] = useState<number | null>(null);

  const [telModal, setTelModal] = useState(false);
  const [telIdx, setTelIdx] = useState<number | null>(null);

  // ── Emails ──
  function confirmarEmail(endereco: string, principal: boolean) {
    let next = [...emails];
    const idx = emailIdx;
    if (idx !== null) {
      next[idx] = { endereco, principal };
      if (principal) next = next.map((e, i) => (i === idx ? e : { ...e, principal: false }));
    } else {
      next.push({ endereco, principal });
      if (principal) next = next.map((e, i) => (i === next.length - 1 ? e : { ...e, principal: false }));
    }
    onEmailsChange(ordenar(next));
    setEmailModal(false);
  }

  function removerEmail(i: number) {
    onEmailsChange(emails.filter((_, idx) => idx !== i));
  }

  // ── Telefones ──
  function confirmarTelefone(numero: string, tipo: TipoTelefone, principal: boolean) {
    let next = [...telefones];
    const idx = telIdx;
    if (idx !== null) {
      next[idx] = { numero, tipo, principal };
      if (principal) next = next.map((t, i) => (i === idx ? t : { ...t, principal: false }));
    } else {
      next.push({ numero, tipo, principal });
      if (principal) next = next.map((t, i) => (i === next.length - 1 ? t : { ...t, principal: false }));
    }
    onTelefonesChange(ordenar(next));
    setTelModal(false);
  }

  function removerTelefone(i: number) {
    onTelefonesChange(telefones.filter((_, idx) => idx !== i));
  }

  const emailActions = disabled ? undefined : [
    { icon: "/icons/actions/Editar.svg", label: "Editar",
      onClick: (row: Record<string, unknown>) => {
        const i = emails.findIndex((e) => e.endereco === row.endereco);
        if (i >= 0) { setEmailIdx(i); setEmailModal(true); }
      } },
    { icon: "/icons/actions/Lixeira.svg", label: "Excluir",
      onClick: (row: Record<string, unknown>) => {
        const i = emails.findIndex((e) => e.endereco === row.endereco);
        if (i >= 0) removerEmail(i);
      } },
  ];

  const telActions = disabled ? undefined : [
    { icon: "/icons/actions/Editar.svg", label: "Editar",
      onClick: (row: Record<string, unknown>) => {
        const i = telefones.findIndex((t) => t.numero === row.numero);
        if (i >= 0) { setTelIdx(i); setTelModal(true); }
      } },
    { icon: "/icons/actions/Lixeira.svg", label: "Excluir",
      onClick: (row: Record<string, unknown>) => {
        const i = telefones.findIndex((t) => t.numero === row.numero);
        if (i >= 0) removerTelefone(i);
      } },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
      {/* Emails */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={sectionTitle}>E-mails</h3>
          {!disabled && (
            <Button label="Novo" iconLeft={novoIcon}
              onClick={() => { setEmailIdx(null); setEmailModal(true); }} />
          )}
        </div>
        <DataTable columns={emailColumns} data={emails} actions={emailActions} idField="endereco" pageSize={5} />
        {emails.map((e, i) => (
          <div key={`he-${i}`} style={{ display: "none" }}>
            <input name="email_endereco" value={e.endereco} readOnly />
            <input name="email_principal" value={String(e.principal)} readOnly />
          </div>
        ))}
      </div>

      {/* Telefones */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={sectionTitle}>Telefones</h3>
          {!disabled && (
            <Button label="Novo" iconLeft={novoIcon}
              onClick={() => { setTelIdx(null); setTelModal(true); }} />
          )}
        </div>
        <DataTable columns={telefoneColumns} data={telefones} actions={telActions} idField="numero" pageSize={5} />
        {telefones.map((t, i) => (
          <div key={`ht-${i}`} style={{ display: "none" }}>
            <input name="telefone_numero" value={t.numero} readOnly />
            <input name="telefone_tipo" value={t.tipo} readOnly />
            <input name="telefone_principal" value={String(t.principal)} readOnly />
          </div>
        ))}
      </div>

      <EmailForm
        key={`email-${emailIdx ?? "novo"}`}
        open={emailModal}
        onClose={() => setEmailModal(false)}
        onConfirm={confirmarEmail}
        initialEndereco={emailIdx !== null ? emails[emailIdx]?.endereco : ""}
        initialPrincipal={emailIdx !== null ? emails[emailIdx]?.principal : false}
        editing={emailIdx !== null}
      />

      <TelefoneForm
        key={`tel-${telIdx ?? "novo"}`}
        open={telModal}
        onClose={() => setTelModal(false)}
        onConfirm={confirmarTelefone}
        initialNumero={telIdx !== null ? telefones[telIdx]?.numero : ""}
        initialTipo={telIdx !== null ? telefones[telIdx]?.tipo : "CELULAR"}
        initialPrincipal={telIdx !== null ? telefones[telIdx]?.principal : false}
        editing={telIdx !== null}
      />
    </div>
  );
}
