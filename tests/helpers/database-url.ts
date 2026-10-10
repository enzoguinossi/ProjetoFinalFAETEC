export function derivarUrlDeTeste(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/[^/?]+(\?.*)?$/, "/nexus_test$1");
}

export function nomeDoBanco(url: string): string {
  const semQuery = url.split("?")[0] ?? "";
  const partes = semQuery.split("/");
  return partes[partes.length - 1] ?? "";
}

/**
 * URL do banco de testes. Prioriza TEST_DATABASE_URL; senão deriva `nexus_test`
 * a partir do DATABASE_URL. Recusa qualquer banco cujo nome não contenha "test".
 */
export function urlDeTeste(): string {
  const url =
    process.env.TEST_DATABASE_URL ?? derivarUrlDeTeste(process.env.DATABASE_URL);
  if (!url) {
    throw new Error(
      "Defina TEST_DATABASE_URL (ou DATABASE_URL) para rodar os testes.",
    );
  }
  const nome = nomeDoBanco(url);
  if (!nome.includes("test")) {
    throw new Error(
      `Recusando rodar testes contra o banco "${nome}": o nome deve conter "test".`,
    );
  }
  return url;
}
