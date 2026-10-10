/** Lê um campo JSON do FormData. Retorna null quando ausente ou inválido. */
export function lerJson(formData: FormData, campo: string): unknown {
  const raw = formData.get(campo);
  if (!raw) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

export function parsePermissoes(formData: FormData): string[] {
  const parsed = lerJson(formData, "permissoes");
  return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
}

export type EnderecoFormData = {
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
};

function numeroOuUndefined(formData: FormData, campo: string): number | undefined {
  const valor = formData.get(campo);
  return valor ? Number(valor) : undefined;
}

/** Lê os campos de endereço do FormData (create: logradouro/cidade como string). */
export function lerEnderecoDoFormData(formData: FormData): EnderecoFormData {
  return {
    logradouro: (formData.get("logradouro") as string) || "",
    numero: (formData.get("numero") as string) || undefined,
    complemento: (formData.get("complemento") as string) || undefined,
    bairro: (formData.get("bairro") as string) || undefined,
    cidade: (formData.get("cidade") as string) || "",
    uf: (formData.get("uf") as string) || undefined,
    cep: (formData.get("cep") as string) || undefined,
    latitude: numeroOuUndefined(formData, "latitude"),
    longitude: numeroOuUndefined(formData, "longitude"),
  };
}

/** Lê os campos de endereço do FormData para update (campos vazios viram undefined). */
export function lerEnderecoParcialDoFormData(formData: FormData): Partial<EnderecoFormData> {
  const endereco = lerEnderecoDoFormData(formData);
  return {
    ...endereco,
    logradouro: endereco.logradouro || undefined,
    cidade: endereco.cidade || undefined,
  };
}
