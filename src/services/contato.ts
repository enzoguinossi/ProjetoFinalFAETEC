import { TIPO_TELEFONE, type TipoTelefone } from "@/types";

export type EmailInput = { endereco: string; principal: boolean };
export type TelefoneInput = { numero: string; tipo: TipoTelefone; principal: boolean };

export type ContatosInput = { emails: EmailInput[]; telefones: TelefoneInput[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      const endereco = emailEnderecos[i]?.trim();
      if (!endereco) continue;
      if (!EMAIL_RE.test(endereco)) {
        return { error: `E-mail inválido: ${endereco}` };
      }
      emails.push({ endereco, principal: emailPrincipais[i] ?? false });
    }
    if (emails.filter((e) => e.principal).length > 1) {
      return { error: "Apenas um e-mail pode ser o principal." };
    }

    const telefones: TelefoneInput[] = [];
    const telefoneNumeros = formData.getAll("telefone_numero") as string[];
    const telefoneTipos = formData.getAll("telefone_tipo") as string[];
    const telefonePrincipais = toBoolArray(formData.getAll("telefone_principal") as string[]);
    for (let i = 0; i < telefoneNumeros.length; i++) {
      const numero = telefoneNumeros[i]?.trim();
      if (!numero) continue;
      const tipo = telefoneTipos[i] as TipoTelefone;
      if (!TIPO_TELEFONE.includes(tipo)) {
        return { error: `Tipo de telefone inválido para ${numero}.` };
      }
      telefones.push({ numero, tipo, principal: telefonePrincipais[i] ?? false });
    }
    if (telefones.filter((t) => t.principal).length > 1) {
      return { error: "Apenas um telefone pode ser o principal." };
    }

    return { contatos: { emails, telefones } };
  }
}

export const contatoService = new ContatoService();
