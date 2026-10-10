import { TIPO_TELEFONE, type TipoTelefone } from "@/types";
import { validarEmail } from "@/lib/email";
import { formatarTelefone, validarTelefone } from "@/lib/telefone";
import { lerJson } from "@/lib/form-data";

export type EmailInput = { endereco: string; principal: boolean };
export type TelefoneInput = { numero: string; tipo: TipoTelefone; principal: boolean };

export type ContatosInput = { emails: EmailInput[]; telefones: TelefoneInput[] };

type EmailBruto = { endereco: string; principal: boolean };
type TelefoneBruto = { numero: string; tipo: string; principal: boolean };

function ehRegistro(item: unknown): item is Record<string, unknown> {
  return typeof item === "object" && item !== null;
}

/** Lê o campo `contatos` (JSON: { emails, telefones }) do FormData. */
function lerContatosBrutos(
  formData: FormData,
): { emails: EmailBruto[]; telefones: TelefoneBruto[] } | { error: string } {
  const raw = lerJson(formData, "contatos");
  if (raw === null) return { emails: [], telefones: [] };
  if (!ehRegistro(raw)) return { error: "Dados de contatos inválidos." };

  const emailsRaw = raw.emails ?? [];
  const telefonesRaw = raw.telefones ?? [];
  if (!Array.isArray(emailsRaw) || !Array.isArray(telefonesRaw)) {
    return { error: "Dados de contatos inválidos." };
  }

  const emails: EmailBruto[] = [];
  for (const item of emailsRaw) {
    if (!ehRegistro(item) || typeof item.endereco !== "string") {
      return { error: "Dados de contatos inválidos." };
    }
    emails.push({ endereco: item.endereco, principal: item.principal === true });
  }

  const telefones: TelefoneBruto[] = [];
  for (const item of telefonesRaw) {
    if (!ehRegistro(item) || typeof item.numero !== "string" || typeof item.tipo !== "string") {
      return { error: "Dados de contatos inválidos." };
    }
    telefones.push({
      numero: item.numero,
      tipo: item.tipo,
      principal: item.principal === true,
    });
  }

  return { emails, telefones };
}

export class ContatoService {
  /**
   * Lê o campo `contatos` (JSON) do FormData, valida e normaliza, garantindo no
   * máximo um principal por lista. Retorna { error } em caso de problema.
   */
  resolverContatosParaSalvar(formData: FormData): { contatos: ContatosInput } | { error: string } {
    const brutos = lerContatosBrutos(formData);
    if ("error" in brutos) return brutos;

    const emails: EmailInput[] = [];
    for (const { endereco, principal } of brutos.emails) {
      const bruto = endereco.trim();
      if (!bruto) continue;
      const email = validarEmail(bruto);
      if (!email.ok) return { error: email.erro };
      if (emails.some((e) => e.endereco.toLowerCase() === email.endereco.toLowerCase())) {
        return { error: `E-mail duplicado na lista: ${email.endereco}` };
      }
      emails.push({ endereco: email.endereco, principal });
    }
    if (emails.filter((e) => e.principal).length > 1) {
      return { error: "Apenas um e-mail pode ser o principal." };
    }

    const telefones: TelefoneInput[] = [];
    for (const { numero, tipo, principal } of brutos.telefones) {
      const bruto = numero.trim();
      if (!bruto) continue;
      if (!TIPO_TELEFONE.includes(tipo as TipoTelefone)) {
        return { error: `Tipo de telefone inválido para ${bruto}.` };
      }
      const tel = validarTelefone(bruto);
      if (!tel.ok) return { error: `${tel.erro} (${bruto})` };
      if (telefones.some((t) => t.numero === tel.numero)) {
        return { error: `Telefone duplicado na lista: ${formatarTelefone(tel.numero)}` };
      }
      telefones.push({ numero: tel.numero, tipo: tipo as TipoTelefone, principal });
    }
    if (telefones.filter((t) => t.principal).length > 1) {
      return { error: "Apenas um telefone pode ser o principal." };
    }

    return { contatos: { emails, telefones } };
  }
}

export const contatoService = new ContatoService();
