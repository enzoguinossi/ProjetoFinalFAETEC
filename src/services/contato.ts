import { TIPO_TELEFONE, type TipoTelefone } from "@/types";
import { validarEmail } from "@/lib/email";
import { formatarTelefone, validarTelefone } from "@/lib/telefone";

export type EmailInput = { endereco: string; principal: boolean };
export type TelefoneInput = { numero: string; tipo: TipoTelefone; principal: boolean };

export type ContatosInput = { emails: EmailInput[]; telefones: TelefoneInput[] };

function toBoolArray(values: string[]): boolean[] {
  return values.map((v) => v === "true" || v === "on");
}

export class ContatoService {
  /**
   * Lê email_* / telefone_* do FormData, valida e normaliza garante no
   * máximo um principal por lista. Retorna { error } em caso de problema.
   */
  resolverContatosParaSalvar(formData: FormData): { contatos: ContatosInput } | { error: string } {
    const emails: EmailInput[] = [];
    const emailEnderecos = formData.getAll("email_endereco") as string[];
    const emailPrincipais = toBoolArray(formData.getAll("email_principal") as string[]);
    for (let i = 0; i < emailEnderecos.length; i++) {
      const bruto = emailEnderecos[i]?.trim();
      if (!bruto) continue;
      const email = validarEmail(bruto);
      if (!email.ok) return { error: email.erro };
      if (emails.some((e) => e.endereco.toLowerCase() === email.endereco.toLowerCase())) {
        return { error: `E-mail duplicado na lista: ${email.endereco}` };
      }
      emails.push({ endereco: email.endereco, principal: emailPrincipais[i] ?? false });
    }
    if (emails.filter((e) => e.principal).length > 1) {
      return { error: "Apenas um e-mail pode ser o principal." };
    }

    const telefones: TelefoneInput[] = [];
    const telefoneNumeros = formData.getAll("telefone_numero") as string[];
    const telefoneTipos = formData.getAll("telefone_tipo") as string[];
    const telefonePrincipais = toBoolArray(formData.getAll("telefone_principal") as string[]);
    for (let i = 0; i < telefoneNumeros.length; i++) {
      const bruto = telefoneNumeros[i]?.trim();
      if (!bruto) continue;
      const tipo = telefoneTipos[i] as TipoTelefone;
      if (!TIPO_TELEFONE.includes(tipo)) {
        return { error: `Tipo de telefone inválido para ${bruto}.` };
      }
      const tel = validarTelefone(bruto);
      if (!tel.ok) return { error: `${tel.erro} (${bruto})` };
      if (telefones.some((t) => t.numero === tel.numero)) {
        return { error: `Telefone duplicado na lista: ${formatarTelefone(tel.numero)}` };
      }
      telefones.push({ numero: tel.numero, tipo, principal: telefonePrincipais[i] ?? false });
    }
    if (telefones.filter((t) => t.principal).length > 1) {
      return { error: "Apenas um telefone pode ser o principal." };
    }

    return { contatos: { emails, telefones } };
  }
}

export const contatoService = new ContatoService();
