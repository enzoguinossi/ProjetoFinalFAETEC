"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import EmailForm from "@/components/EmailForm";
import TelefoneForm from "@/components/TelefoneForm";
import Button from "@/components/Button";
import type { TipoTelefone } from "@/types";
import { useAviso } from "@/components/AvisoProvider";
import { formatarTelefone, TIPO_TELEFONE_LABEL } from "@/lib/telefone";

export type EmailEntry = { endereco: string; principal: boolean };
export type TelefoneEntry = { numero: string; tipo: TipoTelefone; principal: boolean };

interface Props {
  emails: EmailEntry[];
  telefones: TelefoneEntry[];
  onEmailsChange: (next: EmailEntry[]) => void;
  onTelefonesChange: (next: TelefoneEntry[]) => void;
  disabled?: boolean;
}

const tituloSecao = "m-0 font-display text-lg font-[590] tracking-[-0.028125rem] text-ink-strong";

const emailColumns: Column<EmailEntry>[] = [
  { key: "endereco", label: "E-mail", width: "3fr", align: "left" },
];

const telefoneColumns: Column<TelefoneEntry>[] = [
  { key: "numero", label: "Número", width: "2fr", align: "center", render: (v) => formatarTelefone(String(v)) },
  { key: "tipo", label: "Tipo", width: "1.5fr", align: "center", render: (v) => TIPO_TELEFONE_LABEL[v as TipoTelefone] ?? String(v) },
];

function ordenar<T extends { principal: boolean }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.principal) - Number(a.principal));
}

function aplicarPrincipal<T extends { principal: boolean }>(
  list: T[],
  idx: number | null,
  item: T,
): T[] {
  const next = idx !== null ? list.map((atual, i) => (i === idx ? item : atual)) : [...list, item];
  if (!item.principal) return ordenar(next);
  const alvo = idx ?? next.length - 1;
  return ordenar(next.map((atual, i) => (i === alvo ? atual : { ...atual, principal: false })));
}

const novoIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" data-figma-icon="Adicionar">
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

  const mostrarAviso = useAviso();

  // ── Emails ──
  function confirmarEmail(endereco: string, principal: boolean) {
    const conflito = principal && emails.some((e, i) => e.principal && i !== emailIdx);
    onEmailsChange(aplicarPrincipal(emails, emailIdx, { endereco, principal }));
    setEmailModal(false);
    if (conflito) {
      mostrarAviso("Já existe um e-mail principal. O anterior foi desmarcado e este passou a ser o principal.", "cautela");
    }
  }

  function removerEmail(i: number) {
    onEmailsChange(emails.filter((_, idx) => idx !== i));
  }

  // ── Telefones ──
  function confirmarTelefone(numero: string, tipo: TipoTelefone, principal: boolean) {
    const conflito = principal && telefones.some((t, i) => t.principal && i !== telIdx);
    onTelefonesChange(aplicarPrincipal(telefones, telIdx, { numero, tipo, principal }));
    setTelModal(false);
    if (conflito) {
      mostrarAviso("Já existe um telefone principal. O anterior foi desmarcado e este passou a ser o principal.", "cautela");
    }
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
    <div className="grid h-full min-h-0 grid-rows-2 gap-5">
      {/* Emails */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className={tituloSecao}>E-mails</h3>
          {!disabled && (
            <Button label="Novo" iconLeft={novoIcon}
              onClick={() => { setEmailIdx(null); setEmailModal(true); }} />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DataTable columns={emailColumns} data={emails} actions={emailActions} idField="endereco" pageSize={5} />
        </div>
      </div>

      {/* Telefones */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className={tituloSecao}>Telefones</h3>
          {!disabled && (
            <Button label="Novo" iconLeft={novoIcon}
              onClick={() => { setTelIdx(null); setTelModal(true); }} />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DataTable columns={telefoneColumns} data={telefones} actions={telActions} idField="numero" pageSize={5} />
        </div>
      </div>

      {emailModal && (
        <EmailForm
          open
          onClose={() => setEmailModal(false)}
          onConfirm={confirmarEmail}
          initialEndereco={emailIdx !== null ? emails[emailIdx]?.endereco : ""}
          initialPrincipal={emailIdx !== null ? emails[emailIdx]?.principal : false}
          editing={emailIdx !== null}
        />
      )}

      {telModal && (
        <TelefoneForm
          open
          onClose={() => setTelModal(false)}
          onConfirm={confirmarTelefone}
          initialNumero={telIdx !== null ? telefones[telIdx]?.numero : ""}
          initialTipo={telIdx !== null ? telefones[telIdx]?.tipo : "CELULAR"}
          initialPrincipal={telIdx !== null ? telefones[telIdx]?.principal : false}
          editing={telIdx !== null}
        />
      )}
    </div>
  );
}
