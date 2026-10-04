"use client";

import { useMemo, useState } from "react";
import { createUsuario, updateUsuario } from "./actions";
import type { UsuarioFormData } from "./actions";
import Button from "@/components/Button";
import PerfilForm from "@/components/PerfilForm";
import PermissoesPanel, { type GrupoPermissoes } from "@/components/PermissoesPanel";
import styles from "./UsuarioForm.module.css";

interface Funcionario {
  id_funcionario: number;
  pessoaFisica: { nome: string };
}

interface PerfilOption {
  id_perfil: number;
  nome: string;
  descricao: string | null;
}

interface Props {
  funcionarios: Funcionario[];
  grupos: GrupoPermissoes[];
  perfis: PerfilOption[];
  perfilPermissoes: Record<number, string[]>;
  mode?: "create" | "edit" | "view";
  initialData?: UsuarioFormData;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function agruparPorPrefixo(nomes: string[], todas: string[]): string[] {
  const set = new Set(todas);
  return nomes.filter((n) => set.has(n));
}

export default function UsuarioForm({
  funcionarios, grupos, perfis, perfilPermissoes,
  mode = "create", initialData, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isSuperAdmin = initialData?.super_admin ?? false;

  const todasDisponiveis = useMemo(
    () => grupos.flatMap((g) => g.permissoes.map((p) => p.nome)),
    [grupos],
  );

  // Garante que o funcionário vinculado apareça nas opções, mesmo já tendo usuário.
  const opcoesFuncionario = useMemo(() => {
    const lista = [...funcionarios];
    if (
      initialData &&
      !lista.some((f) => f.id_funcionario === initialData.id_funcionario)
    ) {
      lista.unshift({
        id_funcionario: initialData.id_funcionario,
        pessoaFisica: { nome: initialData.nome_funcionario },
      });
    }
    return lista;
  }, [funcionarios, initialData]);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [login, setLogin] = useState(initialData?.login ?? "");
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [idFuncionario, setIdFuncionario] = useState(initialData?.id_funcionario ?? null);
  const [selecionadas, setSelecionadas] = useState<string[]>(
    initialData?.permissoes ? agruparPorPrefixo(initialData.permissoes, todasDisponiveis) : [],
  );
  const [perfilModal, setPerfilModal] = useState(false);

  function aplicarPerfil(id_perfil: number) {
    setSelecionadas(perfilPermissoes[id_perfil] ?? []);
    setPerfilModal(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      form.set("permissoes", JSON.stringify(selecionadas));
      if (initialData) form.set("id_usuario", String(initialData.id_usuario));
      const result = initialData
        ? await updateUsuario(form)
        : await createUsuario(form);
      if (result.error) setError(result.error);
      else onSuccess?.();
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} style={{ maxWidth: "100%" }} onSubmit={handleSubmit}>
      {error && <div className={styles.error}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Coluna esquerda — dados */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {isEdit && (
            <label className={styles.checkboxLabel}>
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} />
              Ativo
            </label>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Funcionário</label>
            {isView ? (
              <p className={styles.input} style={{ lineHeight: "2.5", padding: "0 0.75rem" }}>
                {initialData?.nome_funcionario ?? "—"}
              </p>
            ) : (
              <select
                className={styles.select}
                name="id_funcionario"
                required={!isView}
                value={idFuncionario ?? ""}
                onChange={(e) => setIdFuncionario(e.target.value ? Number(e.target.value) : null)}
                disabled={isView || isEdit}
              >
                <option value="">Selecione...</option>
                {opcoesFuncionario.map((f) => (
                  <option key={f.id_funcionario} value={f.id_funcionario}>
                    {f.pessoaFisica.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Login (e-mail)</label>
            <input
              className={styles.input}
              type="email"
              name="login"
              required={!isView}
              value={isView || isEdit ? login : undefined}
              onChange={isEdit ? (e) => setLogin(e.target.value) : undefined}
              readOnly={isView}
            />
          </div>

          {isSuperAdmin && (
            <div style={{ padding: "0.5rem 0.75rem", background: "#fff8e1", border: "1px solid #f0c14b", borderRadius: 6, color: "#7a5a00", fontFamily: "Inter,sans-serif", fontSize: "0.8125rem" }}>
              Super Admin possui todas as permissões e não pode ser editado.
            </div>
          )}
        </div>

        {/* Coluna direita — permissões */}
        <PermissoesPanel
          grupos={grupos}
          selecionadas={selecionadas}
          onChange={setSelecionadas}
          disabled={isView || isSuperAdmin}
          tituloSelecionadas="Do usuário"
          acoes={
            !isView && !isSuperAdmin
              ? <Button label="Aplicar perfil" onClick={() => setPerfilModal(true)} />
              : undefined
          }
        />
      </div>

      <div className={styles.actions}>
        {isView ? (
          <Button label="Fechar" variant="cancel" onClick={onCancel} />
        ) : (
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} />
          </>
        )}
      </div>

      <PerfilForm
        open={perfilModal}
        onClose={() => setPerfilModal(false)}
        onConfirm={aplicarPerfil}
        perfis={perfis}
      />
    </form>
  );
}
