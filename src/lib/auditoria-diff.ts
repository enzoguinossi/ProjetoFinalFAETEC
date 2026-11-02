export type SituacaoItem = "alterado" | "novo" | "removido";

/** Linha de diff achatada: campo simples ou campo de um item de coleção. */
export type CampoDiff = {
  /** Rótulo do grupo (“Itens”, “Saldos”…); `null` = campo simples. */
  grupo: string | null;
  /** “Item #34 · Lápis de cor…” — `null` = campo simples. */
  item: string | null;
  situacao: SituacaoItem | null;
  /** Rótulo do campo (“Qtd. entregue”). */
  campo: string;
  antes: string;
  depois: string;
};

/** “produto:9” → “Lápis de cor…”. */
export type ReferenciasAuditoria = Map<string, string>;

const LIMITE_TEXTO = 120;
const SENSIVEL = /senha|token|secret/i;
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const ROTULOS_GRUPO: Record<string, string> = {
  itens: "Itens",
  saldos: "Saldos",
  movimentacoes: "Movimentações",
  notas_expedicao: "Notas da expedição",
  codigos: "Códigos",
  emails: "E-mails",
  telefones: "Telefones",
  insumos: "Insumos",
  servicos_liberados: "Serviços liberados",
};

const CHAVE_COLECAO: Record<string, string> = {
  itens: "id_item_nota_saida",
  saldos: "id_produto",
  movimentacoes: "id_movimentacao",
  notas_expedicao: "id_nota_saida",
};

const ROTULOS_ITEM: Record<string, string> = {
  produto: "Produto",
  item: "Item",
  item_nota_saida: "Item",
  item_nota_entrada: "Item",
  movimentacao: "Movimento",
  nota: "Nota",
  nota_saida: "Nota",
  nota_entrada: "Nota de entrada",
  usuario: "Usuário",
  funcionario: "Funcionário",
  destinatario: "Destinatário",
  fornecedor: "Fornecedor",
  expedicao: "Expedição",
  veiculo: "Veículo",
  pedido_escola: "Pedido",
  inventario: "Inventário",
  perfil: "Perfil",
  permissao: "Permissão",
  item_pedido_escola: "Item do pedido",
  item_inventario: "Item do inventário",
  item_coleta: "Item da coleta",
};

const ROTULOS_ITEM_GRUPO: Record<string, string> = {
  itens: "Item",
  saldos: "Produto",
  movimentacoes: "Movimento",
  notas_expedicao: "Nota",
  codigos: "Código",
  emails: "E-mail",
  telefones: "Telefone",
  insumos: "Insumo",
  servicos_liberados: "Serviço liberado",
};

const ROTULOS_CAMPO: Record<string, string> = {
  descricao: "Descrição",
  razao_social: "Razão social",
  nome: "Nome",
  cnpj: "CNPJ",
  cpf: "CPF",
  email: "E-mail",
  telefone: "Telefone",
  endereco: "Endereço",
  logradouro: "Logradouro",
  numero: "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
  cep: "CEP",
  ativo: "Ativo",
  status: "Situação",
  situacao: "Situação",
  tipo: "Tipo",
  tipo_destinatario: "Tipo",
  tipo_telefone: "Tipo",
  observacao: "Observação",
  justificativa: "Justificativa",
  quantidade: "Quantidade",
  qtd_esperada: "Qtd. esperada",
  qtd_entregue: "Qtd. entregue",
  saldo: "Saldo",
  saldo_reservado: "Reservado",
  saldo_anterior: "Saldo anterior",
  saldo_posterior: "Saldo posterior",
  reservado: "Reservado",
  livre: "Qtd. livre",
  data_hora: "Data/hora",
  data_criacao: "Data de criação",
  data_prevista: "Data prevista",
  data_recebimento: "Data de recebimento",
  data_validade: "Validade",
  data_tentativa: "Data da tentativa",
  data_adicao: "Data de adição",
  data_inicio: "Data de início",
  data_fim: "Data de fim",
  hora_inicio: "Hora de início",
  hora_fim: "Hora de fim",
  principal: "Principal",
  pessoal: "Pessoal",
  cargo: "Cargo",
  condutor: "Condutor",
  login: "Login",
  senha_hash: "Senha",
  chave_acesso: "Chave de acesso",
  placa: "Placa",
  modelo: "Modelo",
  perecivel: "Perecível",
  composto: "Composto",
  padrao: "Padrão",
  fator: "Fator",
  codigo: "Código",
  ordem_visita: "Ordem de visita",
  urgente: "Urgente",
  aprovado: "Aprovado",
  quantidade_sistema: "Qtd. do sistema",
  quantidade_final: "Qtd. final",
  origem: "Origem",
  acao: "Ação",
  entidade: "Entidade",
  id_produto: "Produto",
  id_usuario: "Usuário",
  id_funcionario: "Funcionário",
  id_destinatario: "Destinatário",
  id_fornecedor: "Fornecedor",
  id_nota_saida: "Nota de saída",
  id_nota_entrada: "Nota de entrada",
  id_veiculo: "Veículo",
  id_expedicao: "Expedição",
  id_pedido_escola: "Pedido",
  id_inventario: "Inventário",
  id_usuario_tentativa: "Usuário da tentativa",
  id_usuario_aprovacao: "Usuário da aprovação",
  id_usuario_decisao: "Usuário da decisão",
  id_funcionario_condutor: "Condutor",
  id_item_nota_saida: "Item da nota de saída",
  id_movimentacao: "Movimento",
  id_conversao_padrao: "Unidade de entrada",
  id_conversao_saida: "Unidade de saída",
  id_ajuste_inventario: "Ajuste de inventário",
};

const ROTULOS_VALOR: Record<string, string> = {
  ABERTA: "Aberta",
  EM_PERCURSO: "Em percurso",
  PENDENTE: "Pendente",
  BAIXA_TOTAL: "Baixa total",
  BAIXA_PARCIAL: "Baixa parcial",
  BAIXA_COM_CORTE: "Baixa com corte",
  CANCELADA: "Cancelada",
  PLANEJADA: "Planejada",
  CONCLUIDA: "Concluída",
  CONFIRMADO: "Aprovado",
  RECUSADO: "Recusado",
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AVARIA: "Avaria",
  CONSUMO_INTERNO: "Consumo interno",
  DESMONTAGEM: "Desmontagem",
  CELULAR: "Celular",
  FIXO: "Fixo",
  COMERCIAL: "Comercial",
  ESCOLA: "Escola",
  CRECHE: "Creche",
  CMEI: "CMEI",
  CMEIA: "CMEIA",
  MEDIA: "Média",
  CONTAGEM: "Contagem",
  ENTREGUE: "Entregue",
  DISPONIVEL: "Disponível",
  INDISPONIVEL: "Indisponível",
  EM_EXPEDICAO: "Em expedição",
  SIM: "Sim",
  NAO: "Não",
};

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function ehArrayDeObjetos(valor: unknown): valor is Record<string, unknown>[] {
  return Array.isArray(valor) && valor.some((item) => ehObjeto(item));
}

/** `snake_case` → “Snake case” (fallback de rótulos). */
function humanizar(valor: string): string {
  const texto = valor.replace(/\./g, " ").replace(/_/g, " ").trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : valor;
}

function rotuloCampo(campo: string): string {
  const ultimo = campo.split(".").pop() ?? campo;
  return ROTULOS_CAMPO[campo] ?? ROTULOS_CAMPO[ultimo] ?? humanizar(campo);
}

function rotuloGrupo(grupo: string): string {
  return ROTULOS_GRUPO[grupo] ?? humanizar(grupo);
}

function tipoDoId(campo: string): string | null {
  const ultimo = campo.split(".").pop() ?? campo;
  if (!ultimo.startsWith("id_")) return null;
  const bruto = ultimo.slice(3);
  if (bruto.startsWith("usuario")) return "usuario";
  if (bruto.startsWith("funcionario")) return "funcionario";
  return bruto;
}

function rotuloItem(tipo: string | null, grupo: string): string {
  if (tipo) return ROTULOS_ITEM[tipo] ?? humanizar(tipo);
  return ROTULOS_ITEM_GRUPO[grupo] ?? "Item";
}

function truncar(texto: string): string {
  return texto.length > LIMITE_TEXTO
    ? `${texto.slice(0, LIMITE_TEXTO - 1)}…`
    : texto;
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

function formatarDataHora(data: Date): string {
  const dia = formatarData(data);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
  return `${dia} ${hora}`;
}

function formatarPrimitivo(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "string") {
    if (valor === "") return "—";
    if (ISO_DATA.test(valor)) {
      const [ano, mes, dia] = valor.split("-");
      return `${dia}/${mes}/${ano}`;
    }
    if (ISO_DATA_HORA.test(valor)) {
      const data = new Date(valor);
      if (!Number.isNaN(data.getTime())) return formatarDataHora(data);
    }
    return truncar(ROTULOS_VALOR[valor] ?? valor);
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return "—";
    if (valor.every((item) => !ehObjeto(item))) {
      return truncar(valor.map(formatarPrimitivo).join(", "));
    }
    return `${valor.length} item${valor.length === 1 ? "" : "s"}`;
  }
  return "—";
}

/** Valor exibido no diff, com referência de id, enum e datas. */
function formatarValor(
  valor: unknown,
  campo: string,
  referencias: ReferenciasAuditoria,
): string {
  const tipo = tipoDoId(campo);
  if (tipo) {
    if (valor === null || valor === undefined) return "—";
    return (
      referencias.get(`${tipo}:${String(valor)}`) ?? `#${String(valor)}`
    );
  }
  return formatarPrimitivo(valor);
}

function campoEhSensivel(campo: string): boolean {
  const ultimo = campo.split(".").pop() ?? campo;
  return SENSIVEL.test(ultimo);
}

function redigir(valor: unknown): string {
  return valor === null || valor === undefined ? "—" : "[oculto]";
}

function achatar(
  valor: unknown,
  prefixo: string,
  saida: Map<string, unknown>,
): void {
  if (ehObjeto(valor) && Object.keys(valor).length > 0) {
    for (const [chave, filho] of Object.entries(valor)) {
      achatar(filho, prefixo ? `${prefixo}.${chave}` : chave, saida);
    }
    return;
  }
  if (prefixo) saida.set(prefixo, valor);
}

function chaveDoItem(
  item: Record<string, unknown>,
  indice: number,
  chave: string | null,
): string {
  if (chave) {
    const valor = item[chave];
    if (valor !== null && valor !== undefined) return `id:${String(valor)}`;
  }
  return `indice:${indice}`;
}

function valorDoItem(
  item: Record<string, unknown> | undefined,
  chave: string | null,
): string | number | null {
  if (!item || !chave) return null;
  const valor = item[chave];
  if (typeof valor === "string" || typeof valor === "number") return valor;
  return null;
}

function diffColecao(
  grupo: string,
  valorAntes: unknown,
  valorDepois: unknown,
  referencias: ReferenciasAuditoria,
): CampoDiff[] {
  const itensAntes = Array.isArray(valorAntes)
    ? valorAntes.filter(ehObjeto)
    : [];
  const itensDepois = Array.isArray(valorDepois)
    ? valorDepois.filter(ehObjeto)
    : [];
  const todos = [...itensAntes, ...itensDepois];
  if (todos.length === 0) return [];

  const chaveFixa = CHAVE_COLECAO[grupo];
  const temChaveFixa =
    chaveFixa !== undefined &&
    todos.some((item) => item[chaveFixa] !== null && item[chaveFixa] !== undefined);
  const chave =
    (temChaveFixa ? chaveFixa : null) ??
    Object.keys(todos[0]).find((campo) => campo.startsWith("id_")) ??
    null;
  const tipo =
    chave && chave.startsWith("id_") ? tipoDoId(chave) : null;
  const rotulo = rotuloItem(tipo, grupo);

  const mapa = new Map<
    string,
    {
      antes?: Record<string, unknown>;
      depois?: Record<string, unknown>;
      indice: number;
    }
  >();
  const ordem: string[] = [];

  itensAntes.forEach((item, indice) => {
    const chaveItem = chaveDoItem(item, indice, chave);
    ordem.push(chaveItem);
    mapa.set(chaveItem, { antes: item, indice });
  });
  itensDepois.forEach((item, indice) => {
    const chaveItem = chaveDoItem(item, indice, chave);
    if (!mapa.has(chaveItem)) ordem.push(chaveItem);
    const entrada = mapa.get(chaveItem) ?? { indice };
    entrada.depois = item;
    mapa.set(chaveItem, entrada);
  });

  const diff: CampoDiff[] = [];
  for (const chaveItem of ordem) {
    const entrada = mapa.get(chaveItem);
    if (!entrada) continue;

    const situacao: SituacaoItem = !entrada.antes
      ? "novo"
      : !entrada.depois
        ? "removido"
        : "alterado";
    const id = valorDoItem(entrada.antes ?? entrada.depois, chave) ?? entrada.indice + 1;
    const descricao =
      tipo !== null && id !== null
        ? referencias.get(`${tipo}:${String(id)}`)
        : undefined;
    const rotuloItemTexto = `${rotulo} #${String(id)}${
      descricao ? ` · ${descricao}` : ""
    }`;

    const camposAntes = new Map<string, unknown>();
    const camposDepois = new Map<string, unknown>();
    achatar(entrada.antes ?? {}, "", camposAntes);
    achatar(entrada.depois ?? {}, "", camposDepois);
    const campos = [
      ...camposAntes.keys(),
      ...[...camposDepois.keys()].filter((campo) => !camposAntes.has(campo)),
    ].filter((campo) => !(campo.split(".").pop() ?? campo).startsWith("id_"));

    for (const campo of campos) {
      const antes = camposAntes.get(campo);
      const depois = camposDepois.get(campo);
      if (situacao === "alterado" && JSON.stringify(antes) === JSON.stringify(depois)) {
        continue;
      }

      const sensivel = campoEhSensivel(campo);
      const antesTexto = sensivel
        ? redigir(antes)
        : formatarValor(antes, campo, referencias);
      const depoisTexto = sensivel
        ? redigir(depois)
        : formatarValor(depois, campo, referencias);
      if (antesTexto === "—" && depoisTexto === "—") continue;

      diff.push({
        grupo: rotuloGrupo(grupo),
        item: rotuloItemTexto,
        situacao,
        campo:
          grupo === "emails" && campo === "endereco"
            ? "E-mail"
            : grupo === "telefones" && campo === "numero"
              ? "Telefone"
              : rotuloCampo(campo),
        antes: antesTexto,
        depois: depoisTexto,
      });
    }
  }

  return diff;
}

/**
 * Compara os snapshots de `registro_auditoria` e devolve campos simples e
 * campos de itens de coleção já rotulados. Nunca devolve JSON bruto.
 */
export function diffAuditoria(
  antes: unknown,
  depois: unknown,
  referencias: ReferenciasAuditoria = new Map(),
): CampoDiff[] {
  if (
    (antes === null || antes === undefined) &&
    (depois === null || depois === undefined)
  ) {
    return [];
  }

  const objetoAntes = ehObjeto(antes) ? antes : {};
  const objetoDepois = ehObjeto(depois) ? depois : {};
  const chaves = [
    ...Object.keys(objetoAntes),
    ...Object.keys(objetoDepois).filter((chave) => !(chave in objetoAntes)),
  ];

  const diff: CampoDiff[] = [];
  for (const chave of chaves) {
    const valorAntes = chave in objetoAntes ? objetoAntes[chave] : undefined;
    const valorDepois = chave in objetoDepois ? objetoDepois[chave] : undefined;

    if (ehArrayDeObjetos(valorAntes) || ehArrayDeObjetos(valorDepois)) {
      diff.push(...diffColecao(chave, valorAntes, valorDepois, referencias));
      continue;
    }

    const camposAntes = new Map<string, unknown>();
    const camposDepois = new Map<string, unknown>();
    achatar(valorAntes, chave, camposAntes);
    achatar(valorDepois, chave, camposDepois);
    const campos = [
      ...camposAntes.keys(),
      ...[...camposDepois.keys()].filter((campo) => !camposAntes.has(campo)),
    ];

    for (const campo of campos) {
      const antesCampo = camposAntes.get(campo);
      const depoisCampo = camposDepois.get(campo);
      if (JSON.stringify(antesCampo) === JSON.stringify(depoisCampo)) continue;

      const sensivel = campoEhSensivel(campo);
      const antesTexto = sensivel
        ? redigir(antesCampo)
        : formatarValor(antesCampo, campo, referencias);
      const depoisTexto = sensivel
        ? redigir(depoisCampo)
        : formatarValor(depoisCampo, campo, referencias);
      if (antesTexto === "—" && depoisTexto === "—") continue;

      diff.push({
        grupo: null,
        item: null,
        situacao: null,
        campo: rotuloCampo(campo),
        antes: antesTexto,
        depois: depoisTexto,
      });
    }
  }

  return diff;
}
