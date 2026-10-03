export class EntidadeComVinculosError extends Error {
  readonly entidade: string;
  readonly vinculos: string[];

  constructor(entidade: string, vinculos: string[]) {
    super(
      `Não é possível excluir ${entidade} pois possui vínculos: ${vinculos.join(", ")}.`,
    );
    this.name = "EntidadeComVinculosError";
    this.entidade = entidade;
    this.vinculos = vinculos;
  }
}
