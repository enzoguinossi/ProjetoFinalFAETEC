export function parsePermissoes(formData: FormData): string[] {
  const raw = formData.get("permissoes");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
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
