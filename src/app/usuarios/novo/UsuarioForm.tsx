"use client";

import { useMemo, useState } from "react";
import { createUsuario, updateUsuario } from "../actions";
import type { UsuarioFormData } from "../actions";
import Button from "@/components/Button";
import PerfilForm from "@/components/PerfilForm";
import PermissoesPanel, { type GrupoPermissoes } from "@/components/PermissoesPanel";
import { useAviso } from "@/components/AvisoProvider";

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

  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
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
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      form.set("permissoes", JSON.stringify(selecionadas));
      if (initialData) form.set("id_usuario", String(initialData.id_usuario));
      const result = initialData
        ? await updateUsuario(form)
        : await createUsuario(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.();
    } catch {
      mostrarAviso("Erro ao salvar.", "erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4 bg-white rounded-[1.25rem] p-6 w-full box-border max-w-full"
      onSubmit={handleSubmit}
      data-figma="FormularioUsuario"
      data-figma-hug="vertical"
    >
      <div className="grid grid-cols-[360px_1fr] gap-6 items-start">
        {/* Coluna esquerda — dados */}
        <div className="flex flex-col gap-4">
          {isEdit && (
            <label className="flex items-center gap-2 font-sans text-sm text-ink cursor-pointer [&_input[type=checkbox]]:size-[1.125rem] [&_input[type=checkbox]]:accent-brand [&_input[type=checkbox]]:cursor-pointer">
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} />
              Ativo
            </label>
          )}

          <div className="flex flex-col gap-[0.375rem]">
            <label className="font-display text-[0.9375rem] font-medium text-ink">Funcionário</label>
            {isView ? (
              <p className="h-10 px-3 border border-[#c1c7cd] rounded-lg font-sans text-sm outline-none transition-[border-color] duration-[120ms] w-full box-border focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)] leading-[2.5]">
                {initialData?.nome_funcionario ?? "—"}
              </p>
            ) : (
              <select
                className="h-10 px-3 border border-[#c1c7cd] rounded-lg font-sans text-sm outline-none transition-[border-color] duration-[120ms] w-full box-border focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]"
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

          <div className="flex flex-col gap-[0.375rem]">
            <label className="font-display text-[0.9375rem] font-medium text-ink">Login (e-mail)</label>
            <input
              className="h-10 px-3 border border-[#c1c7cd] rounded-lg font-sans text-sm outline-none transition-[border-color] duration-[120ms] w-full box-border focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]"
              type="email"
              name="login"
              required={!isView}
              value={isView || isEdit ? login : undefined}
              onChange={isEdit ? (e) => setLogin(e.target.value) : undefined}
              readOnly={isView}
            />
          </div>

          {isSuperAdmin && (
            <div className="px-3 py-2 bg-[#fff8e1] border border-[#f0c14b] rounded-md text-[#7a5a00] font-sans text-[0.8125rem]">
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

      <div className="flex justify-end gap-3 pt-2 border-t border-table-alt">
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
