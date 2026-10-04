export function formatarCodigo(id: number): string {
  return String(id).padStart(6, "0");
}
