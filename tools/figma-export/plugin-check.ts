/**
 * Verificação do plugin sem o Figma.
 *
 * Executa `plugin/code.js` em um contexto `node:vm` com um mock da Plugin API
 * e roda uma importação real contra as cenas já colhidas em `out/figma-export`.
 *
 * Serve para pegar erros de API e de lógica (auto-layout inválido, texto sem
 * fonte carregada, propriedades de componente, troca de variante, etc.) sem
 * precisar abrir o Figma — e sem gastar nenhuma chamada do MCP.
 *
 * Uso: npm run figma:check
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { OUT_DIR, ROOT, TOOL_DIR } from "./config";
import { ORIGEM } from "./origem";

/* ══════════════════════════════ mock da API ══════════════════════════════ */

const FAMILIAS: Record<string, string[]> = {
  Inter: ["Thin", "Extra Light", "Light", "Regular", "Medium", "Semi Bold", "Bold", "Extra Bold", "Black", "Italic"],
  Roboto: ["Thin", "Light", "Regular", "Medium", "Bold", "Black", "Italic"],
  "Roboto Mono": ["Thin", "ExtraLight", "Light", "Regular", "Medium", "SemiBold", "Bold", "Italic"],
};

let sequencia = 0;
const proximoId = () => `${++sequencia}:${sequencia}`;

const fontesCarregadas = new Set<string>();
const problemas: string[] = [];
const avisos: string[] = [];

/** Registro de componentes por id, para INSTANCE_SWAP em setProperties. */
const componentesPorId = new Map<string, NoComponente>();

function problema(mensagem: string) {
  problemas.push(mensagem);
}

class No {
  id: string;
  type: string;
  name: string;
  parent: No | null = null;
  /**
   * ATENÇÃO: ao contrário do Figma real, aqui `children` inclui filhos
   * invisíveis (o Figma os omite em `InstanceNode.children`). A clonagem de
   * instâncias depende disso; o plugin tem uma guarda para o caso real.
   */
  children: No[] = [];
  x = 0;
  y = 0;
  width = 100;
  height = 100;
  fills: unknown[] = [];
  strokes: unknown[] = [];
  effects: unknown[] = [];
  strokeWeight = 0;
  strokeAlign = "INSIDE";
  strokeTopWeight = 0;
  strokeRightWeight = 0;
  strokeBottomWeight = 0;
  strokeLeftWeight = 0;
  dashPattern: number[] = [];
  topLeftRadius = 0;
  topRightRadius = 0;
  bottomRightRadius = 0;
  bottomLeftRadius = 0;
  clipsContent = false;
  opacity = 1;
  locked = false;
  visible = true;
  removed = false;
  pluginData: Record<string, string> = {};
  bound: Record<string, unknown> = {};
  layoutGrow = 0;
  layoutAlign = "INHERIT";
  layoutPositioning = "AUTO";
  description = "";
  /** Só usado em páginas (fundo geral do quadro). */
  backgrounds: unknown[] = [];
  /**
   * Mestre da instância — acesso INTERNO do mock. A leitura pública é o acessor
   * `mainComponent` de `NoInstancia`, que lança como no Figma real quando o
   * manifest usa `documentAccess: "dynamic-page"`.
   */
  mestre: No | null = null;

  private _layoutMode = "NONE";
  itemSpacing = 0;
  paddingTop = 0;
  paddingRight = 0;
  paddingBottom = 0;
  paddingLeft = 0;
  primaryAxisSizingMode = "AUTO";
  counterAxisSizingMode = "FIXED";
  private _counterAxisAlignItems = "MIN";

  constructor(type: string, name?: string) {
    this.type = type;
    this.id = proximoId();
    this.name = name ?? type;
  }

  get layoutMode() {
    return this._layoutMode;
  }
  set layoutMode(valor: string) {
    if (!["NONE", "HORIZONTAL", "VERTICAL", "GRID"].includes(valor)) {
      problema(`layoutMode inválido: ${valor}`);
    }
    this._layoutMode = valor;
    if (valor !== "NONE") {
      // Como no Figma: um quadro novo nasce com o eixo principal em AUTO, então
      // definir `layoutMode` faz o quadro ABRAÇAR o conteúdo. Quem precisa do
      // tamanho medido tem de fixar as dimensões antes e restaurar depois.
      this._reflow();
    }
  }

  /** Recalcula o tamanho como o motor de layout do Figma faria. */
  _reflow() {
    if (this._layoutMode === "NONE") return;
    // Filhos invisíveis não participam do layout (como no Figma).
    const visiveis = this.children.filter((filho) => filho.visible);
    if (visiveis.length === 0) return;
    const horizontal = this._layoutMode === "HORIZONTAL";
    let principal = 0;
    let cruzado = 0;
    for (const filho of visiveis) {
      principal += horizontal ? filho.width : filho.height;
      cruzado = Math.max(cruzado, horizontal ? filho.height : filho.width);
    }
    const espacos = this.itemSpacing * Math.max(0, visiveis.length - 1);
    const conteudoPrincipal = principal + espacos;
    const conteudoCruzado = cruzado;
    const totalPrincipal =
      conteudoPrincipal + (horizontal ? this.paddingLeft + this.paddingRight : this.paddingTop + this.paddingBottom);
    const totalCruzado =
      conteudoCruzado + (horizontal ? this.paddingTop + this.paddingBottom : this.paddingLeft + this.paddingRight);

    if (this.primaryAxisSizingMode === "AUTO") {
      if (horizontal) this.width = Math.max(1, totalPrincipal);
      else this.height = Math.max(1, totalPrincipal);
    }
    if (this.counterAxisSizingMode === "AUTO") {
      if (horizontal) this.height = Math.max(1, totalCruzado);
      else this.width = Math.max(1, totalCruzado);
    }
  }

  get counterAxisAlignItems() {
    return this._counterAxisAlignItems;
  }
  set counterAxisAlignItems(valor: string) {
    if (!["MIN", "CENTER", "MAX", "BASELINE"].includes(valor)) {
      problema(`counterAxisAlignItems inválido: ${valor}`);
    }
    if (valor === "BASELINE" && this._layoutMode === "VERTICAL") {
      problema("counterAxisAlignItems=BASELINE não é aceito em layout VERTICAL");
    }
    this._counterAxisAlignItems = valor;
  }

  get primaryAxisAlignItems() {
    return this.primaryAxisAlignItemsValor;
  }
  set primaryAxisAlignItems(valor: string) {
    if (!["MIN", "CENTER", "MAX", "SPACE_BETWEEN", "SPACE_AROUND", "SPACE_EVENLY"].includes(valor)) {
      problema(`primaryAxisAlignItems inválido: ${valor}`);
    }
    this.primaryAxisAlignItemsValor = valor;
  }
  private primaryAxisAlignItemsValor = "MIN";

  resize(largura: number, altura: number) {
    if (!Number.isFinite(largura) || !Number.isFinite(altura)) {
      problema(`resize com valor não numérico em ${this.name}`);
    }
    if (largura <= 0 || altura <= 0) {
      problema(`resize com valor <= 0 em ${this.name} (${largura}×${altura})`);
    }
    if (this.type === "TEXT" && (this as unknown as { textAutoResize?: string }).textAutoResize !== "NONE") {
      throw new Error("Cannot resize a text node with auto sizing enabled");
    }
    this.width = largura;
    this.height = altura;
  }

  appendChild(no: No) {
    if (no.parent) {
      no.parent.children = no.parent.children.filter((c) => c !== no);
    }
    this.children.push(no);
    no.parent = this;
    return no;
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.removed = true;
    this.parent = null;
  }

  /**
   * Como no Figma: a API de plugin data exige um `id` no manifest, e um plugin
   * de desenvolvimento local (importado do manifest.json) não tem um. Se o
   * plugin voltar a usar plugin data, a verificação falha aqui.
   */
  setPluginData() {
    throw new Error(
      'in setPluginData: Cannot set private plugin data in a plugin without an ID. Make sure your plugin manifest has a valid "id" field.',
    );
  }
  getPluginData() {
    throw new Error(
      'in getPluginData: Cannot get private plugin data in a plugin without an ID. Make sure your plugin manifest has a valid "id" field.',
    );
  }
  setBoundVariable(campo: string, valor: unknown) {
    this.bound[campo] = valor;
  }
  async loadAsync() {
    return this;
  }
  async exportAsync() {
    return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  }
  findAll() {
    return [];
  }
}

class NoTexto extends No {
  /** Definido por um acessor no protótipo, que valida a fonte carregada. */
  declare characters: string;
  fontName = { family: "Inter", style: "Regular" };
  fontSize = 14;
  lineHeight: unknown = { unit: "AUTO" };
  letterSpacing: unknown = { unit: "PERCENT", value: 0 };
  textCase = "ORIGINAL";
  textDecoration = "NONE";
  textAlignHorizontal = "LEFT";
  textAlignVertical = "TOP";
  textTruncation = "DISABLED";
  componentPropertyReferences: Record<string, string> | null = null;
  private _maxLines: number | null = null;

  constructor() {
    super("TEXT", "Texto");
  }

  get maxLines() {
    return this._maxLines;
  }
  set maxLines(valor: number | null) {
    if (valor !== null && this.textTruncation !== "ENDING") {
      problema("maxLines definido sem textTruncation=ENDING");
    }
    this._maxLines = valor;
  }

  private _auto = "NONE";
  get textAutoResize() {
    return this._auto;
  }
  set textAutoResize(valor: string) {
    if (!["NONE", "HEIGHT", "WIDTH_AND_HEIGHT", "TRUNCATE"].includes(valor)) {
      problema(`textAutoResize inválido: ${valor}`);
    }
    this._auto = valor;
  }
}

const caracteresPorTexto = new WeakMap<object, string>();

// `characters` precisa de fonte carregada — igual ao Figma.
Object.defineProperty(NoTexto.prototype, "characters", {
  get(this: object) {
    return caracteresPorTexto.get(this) ?? "";
  },
  set(this: NoTexto, valor: string) {
    const chave = `${this.fontName.family}|${this.fontName.style}`;
    if (!fontesCarregadas.has(chave)) {
      problema(`characters definido sem carregar a fonte ${chave}`);
    }
    caracteresPorTexto.set(this, String(valor));
  },
});

class NoComponente extends No {
  private _propriedades?: Record<string, { type: string; valor: string | boolean }>;

  constructor(name: string) {
    super("COMPONENT", name);
  }

  /** Criado sob demanda: o mock também converte nós em componentes no lugar. */
  private mapa() {
    if (!this._propriedades) this._propriedades = {};
    return this._propriedades;
  }

  get componentPropertyDefinitions() {
    const saida: Record<string, { type: string; defaultValue: string }> = {};
    for (const [id, info] of Object.entries(this.mapa())) {
      saida[id] = { type: info.type, defaultValue: String(info.valor) };
    }
    return saida;
  }

  get propriedades() {
    return this.mapa();
  }

  addComponentProperty(nome: string, tipo: string, padrao: string | boolean) {
    if (tipo !== "TEXT" && tipo !== "BOOLEAN" && tipo !== "INSTANCE_SWAP" && tipo !== "VARIANT") {
      problema(`tipo de propriedade inválido: ${tipo}`);
    }
    const id = `${nome}#${proximoId()}`;
    this.mapa()[id] = { type: tipo, valor: padrao };
    return id;
  }

  createInstance() {
    const instancia = new NoInstancia(this.name, this);
    // Como no Figma: a instância nasce com o tamanho e o layout do componente.
    instancia.width = this.width;
    instancia.height = this.height;
    instancia.layoutMode = this.layoutMode;
    clonarFilhos(this, instancia);
    return instancia;
  }
}

class NoInstancia extends No {
  propriedades: Record<string, string> = {};

  constructor(name: string, main: No) {
    super("INSTANCE", name);
    this.mestre = main;
  }

  /**
   * Como no Figma real com `documentAccess: "dynamic-page"`, ler
   * `instance.mainComponent` LANÇA — só `getMainComponentAsync` funciona.
   */
  get mainComponent(): No | null {
    throw new Error(
      "in get_mainComponent: Cannot call with documentAccess: dynamic-page. Use node.getMainComponentAsync instead.",
    );
  }

  async getMainComponentAsync(): Promise<No | null> {
    return this.mestre;
  }

  swapComponent(componente: No) {
    if (!(componente instanceof NoComponente)) {
      problema("swapComponent recebeu um nó que não é componente");
    }
    this.mestre = componente;
  }

  setProperties(valores: Record<string, string | boolean>) {
    for (const [chave, valor] of Object.entries(valores)) {
      this.propriedades[chave] = String(valor);
      // aplica em quem referencia a propriedade, como o Figma faz
      for (const no of coletarTodosMock(this)) {
        const refs = (no as unknown as { componentPropertyReferences?: Record<string, string> })
          .componentPropertyReferences;
        if (!refs) continue;
        if (refs.characters === chave && no instanceof NoTexto) {
          no.characters = String(valor);
        }
        if (refs.visible === chave) {
          no.visible = Boolean(valor);
        }
        if (refs.mainComponent === chave && no.type === "INSTANCE") {
          const alvo = componentesPorId.get(String(valor));
          if (alvo) (no as NoInstancia).mestre = alvo;
        }
      }
    }
  }
}

function coletarTodosMock(no: No): No[] {
  const saida: No[] = [no];
  for (const filho of no.children) saida.push(...coletarTodosMock(filho));
  return saida;
}

function coletarTextosMock(no: No): NoTexto[] {
  const saida: NoTexto[] = [];
  if (no instanceof NoTexto) saida.push(no);
  for (const filho of no.children) saida.push(...coletarTextosMock(filho));
  return saida;
}

function coletarInstancias(no: No, saida: No[]): No[] {
  if (no.type === "INSTANCE") saida.push(no);
  for (const filho of no.children) coletarInstancias(filho, saida);
  return saida;
}

function clonarFilhos(origem: No, destino: No) {
  for (const filho of origem.children) {
    let copia: No;
    if (filho instanceof NoTexto) {
      const copiaTexto = new NoTexto();
      // a fonte vem antes: o mock valida a fonte ao definir `characters`
      copiaTexto.fontName = { ...filho.fontName };
      Object.assign(copiaTexto, {
        characters: filho.characters,
        fontSize: filho.fontSize,
        lineHeight: filho.lineHeight,
        letterSpacing: filho.letterSpacing,
        textCase: filho.textCase,
        textDecoration: filho.textDecoration,
        textAlignHorizontal: filho.textAlignHorizontal,
        textAlignVertical: filho.textAlignVertical,
        textTruncation: filho.textTruncation,
        componentPropertyReferences: filho.componentPropertyReferences,
      });
      copiaTexto.textAutoResize = filho.textAutoResize;
      copia = copiaTexto;
    } else if (filho.type === "INSTANCE") {
      const modelo = (filho as NoInstancia).mestre;
      copia = new NoInstancia(filho.name, modelo ?? new NoComponente(filho.name));
      copia.layoutMode = filho.layoutMode;
    } else if (filho.type === "COMPONENT") {
      copia = new NoComponente(filho.name);
      copia.layoutMode = filho.layoutMode;
    } else {
      copia = new No(filho.type, filho.name);
      Object.assign(copia, {
        layoutMode: filho.layoutMode,
        itemSpacing: filho.itemSpacing,
        paddingTop: filho.paddingTop,
        paddingRight: filho.paddingRight,
        paddingBottom: filho.paddingBottom,
        paddingLeft: filho.paddingLeft,
        clipsContent: filho.clipsContent,
      });
    }
    copia.name = filho.name;
    copia.x = filho.x;
    copia.y = filho.y;
    copia.width = filho.width;
    copia.height = filho.height;
    copia.fills = filho.fills;
    copia.strokes = filho.strokes;
    copia.effects = filho.effects;
    copia.strokeWeight = filho.strokeWeight;
    copia.strokeAlign = filho.strokeAlign;
    copia.strokeTopWeight = filho.strokeTopWeight;
    copia.strokeRightWeight = filho.strokeRightWeight;
    copia.strokeBottomWeight = filho.strokeBottomWeight;
    copia.strokeLeftWeight = filho.strokeLeftWeight;
    copia.topLeftRadius = filho.topLeftRadius;
    copia.topRightRadius = filho.topRightRadius;
    copia.bottomLeftRadius = filho.bottomLeftRadius;
    copia.bottomRightRadius = filho.bottomRightRadius;
    copia.opacity = filho.opacity;
    copia.layoutGrow = filho.layoutGrow;
    copia.layoutAlign = filho.layoutAlign;
    copia.visible = filho.visible;
    // referências de propriedade (visible / mainComponent) precisam ir junto
    (copia as unknown as { componentPropertyReferences?: unknown }).componentPropertyReferences = (
      filho as unknown as { componentPropertyReferences?: unknown }
    ).componentPropertyReferences;
    destino.appendChild(copia);
    clonarFilhos(filho, copia);
  }
}

function criarFigmaMock() {
  const paginas: No[] = [];
  const paginaInicial = new No("PAGE", "Page 1");
  paginas.push(paginaInicial);

  const estado = { atual: paginaInicial, uiMensagens: [] as unknown[] };

  const variaveisPorColecao = new Map<string, Record<string, unknown>>();
  /** Coleções e variáveis criadas — a leitura de volta as enumera. */
  const colecoesMock: Array<{
    id: string;
    name: string;
    defaultModeId: string;
    modes: { modeId: string; name: string }[];
  }> = [];
  interface VariavelMock {
    id: string;
    name: string;
    resolvedType: string;
    variableCollectionId: string;
    valuesByMode: Record<string, unknown>;
    scopes: string[];
    setValueForMode(modo: string, valor: unknown): void;
  }
  const variaveisMock: VariavelMock[] = [];

  const figma = {
    root: { get children() { return paginas; } },
    get currentPage() {
      return estado.atual;
    },
    async setCurrentPageAsync(pagina: No) {
      if (!paginas.includes(pagina)) problema("setCurrentPageAsync com página desconhecida");
      estado.atual = pagina;
    },
    createPage() {
      const pagina = new No("PAGE", `Page ${paginas.length + 1}`);
      paginas.push(pagina);
      return pagina;
    },
    createFrame() {
      const quadro = new No("FRAME", "Frame");
      figma.currentPage.appendChild(quadro);
      return quadro;
    },
    createText() {
      const texto = new NoTexto();
      figma.currentPage.appendChild(texto);
      return texto;
    },
    createRectangle() {
      const retangulo = new No("RECTANGLE", "Rectangle");
      figma.currentPage.appendChild(retangulo);
      return retangulo;
    },
    createSection() {
      const secao = new No("SECTION", "Section");
      figma.currentPage.appendChild(secao);
      return secao;
    },
    createComponentFromNode(no: No) {
      if (no.type === "COMPONENT" || no.type === "COMPONENT_SET" || no.type === "INSTANCE") {
        throw new Error("Cannot create component from node");
      }
      let ancestral = no.parent;
      while (ancestral) {
        if (ancestral.type === "COMPONENT" || ancestral.type === "INSTANCE") {
          throw new Error("Cannot create component from a node inside a component/instance");
        }
        ancestral = ancestral.parent;
      }
      // Como no Figma: o próprio nó é convertido — mesmos ids, mesmos filhos.
      Object.setPrototypeOf(no, NoComponente.prototype);
      no.type = "COMPONENT";
      const componente = no as unknown as NoComponente;
      componentesPorId.set(componente.id, componente);
      return componente;
    },
    createNodeFromSvg(svg: string) {
      if (typeof svg !== "string" || svg.indexOf("<svg") < 0) {
        throw new Error("SVG inválido");
      }
      const largura = Number((svg.match(/\bwidth="([\d.]+)"/) || [])[1] || 100);
      const altura = Number((svg.match(/\bheight="([\d.]+)"/) || [])[1] || 100);
      const quadro = new No("FRAME", "svg");
      quadro.width = largura;
      quadro.height = altura;
      figma.currentPage.appendChild(quadro);
      return quadro;
    },
    createImage(bytes: Uint8Array) {
      if (!bytes || typeof bytes.length !== "number" || bytes.length < 8) {
        throw new Error("Bytes de imagem inválidos");
      }
      if (!(bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)) {
        throw new Error("Formato de imagem não suportado (esperado PNG)");
      }
      return { hash: `hash-${bytes.length}-${sequencia}`, getSizeAsync: async () => ({ width: 10, height: 10 }) };
    },
    async loadFontAsync(fonte: { family?: string; style?: string }) {
      const familia = fonte && fonte.family;
      const estilo = fonte && fonte.style;
      if (!familia) {
        // "carregar toda a família"
        return;
      }
      if (!FAMILIAS[familia]) {
        throw new Error(`Fonte indisponível: ${familia}`);
      }
      if (estilo && !FAMILIAS[familia].includes(estilo)) {
        throw new Error(`Estilo indisponível: ${familia} ${estilo}`);
      }
      fontesCarregadas.add(`${familia}|${estilo ?? "Regular"}`);
    },
    notify(mensagem: string) {
      avisos.push(mensagem);
    },
    closePlugin() {
      /* fim */
    },
    showUI() {
      /* interface criada */
    },
    ui: {
      postMessage(mensagem: unknown) {
        estado.uiMensagens.push(mensagem);
      },
      onmessage: null as null | ((msg: unknown) => unknown),
      resize() {},
    },
    variables: {
      createVariableCollection(nome: string) {
        const colecao = {
          id: proximoId(),
          name: nome,
          // Como no Figma: a coleção tem um modo padrão identificado.
          defaultModeId: `${nome}-default`,
          modes: [{ modeId: `${nome}-default`, name: "Mode 1" }],
          renameMode() {},
        };
        variaveisPorColecao.set(colecao.id, {});
        colecoesMock.push(colecao);
        return colecao;
      },
      createVariable(nome: string, colecao: { id: string }, tipo: string) {
        if (!["COLOR", "FLOAT", "STRING", "BOOLEAN"].includes(tipo)) {
          problema(`tipo de variável inválido: ${tipo}`);
        }
        const variavel: VariavelMock = {
          id: proximoId(),
          name: nome,
          resolvedType: tipo,
          variableCollectionId: colecao.id,
          valuesByMode: {},
          scopes: [],
          setValueForMode(modo: string, valor: unknown) {
            variavel.valuesByMode[modo] = valor;
            variaveisPorColecao.get(colecao.id)![nome] = valor;
          },
        };
        variaveisMock.push(variavel);
        return variavel;
      },
      async getLocalVariableCollectionsAsync() {
        return colecoesMock.slice();
      },
      async getLocalVariablesAsync() {
        return variaveisMock.slice();
      },
      async getVariableByIdAsync(id: string) {
        return variaveisMock.find((v) => v.id === id) ?? null;
      },
      setBoundVariableForPaint(paint: unknown, campo: string, variavel: unknown) {
        return { ...(paint as object), boundVariables: { [campo]: variavel } };
      },
    },
    _estado: estado,
  };

  return { figma, estado, paginas };
}

/* ══════════════════════════════ fetch simulado ══════════════════════════════ */

function criarFetch(outDir: string, registros: { verificacoes: string[]; snapshots: Map<string, unknown> }) {
  return async function fetchMock(url: string, init?: { method?: string; body?: unknown }) {
    const caminho = new URL(url).pathname.replace(/^\/export\//, "").replace(/^\//, "");

    if (init && init.method === "POST" && url.includes("/verify/")) {
      registros.verificacoes.push(decodeURIComponent(url.split("/verify/")[1]));
      return resposta(new Uint8Array([1, 2, 3]), 200);
    }

    // volta: o plugin envia a leitura de uma página (o que o figma:diff compara)
    if (init && init.method === "POST" && url.includes("/snapshot/")) {
      const pagina = decodeURIComponent(url.split("/snapshot/")[1]);
      registros.snapshots.set(pagina, JSON.parse(String(init.body)));
      return resposta(null, 200);
    }

    const arquivo = path.join(outDir, caminho);
    if (!existsSync(arquivo)) {
      return resposta(null, 404);
    }
    const dados = readFileSync(arquivo);
    if (caminho.endsWith(".json")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return JSON.parse(dados.toString("utf8"));
        },
        async text() {
          return dados.toString("utf8");
        },
        async arrayBuffer() {
          return dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength);
        },
      };
    }
    return resposta(new Uint8Array(dados), 200);
  };
}

function resposta(bytes: Uint8Array | null, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      throw new Error("não é json");
    },
    async text() {
      return bytes ? Buffer.from(bytes).toString("utf8") : "";
    },
    async arrayBuffer() {
      return bytes ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : new ArrayBuffer(0);
    },
  };
}

/* ═══════════════════════ marcas `data-figma` no app ═══════════════════════ */

/**
 * Nomes marcados com `data-figma` em um arquivo do app. Aceita as formas que o
 * código usa:
 *
 *   data-figma="Nome"        (atributo JSX)
 *   data-figma={'Nome'}      (expressão JSX)
 *   data-figma={"Nome"}
 *   "data-figma": "Nome"     (chave de objeto — é assim que o Button monta as marcas)
 *
 * Os atributos derivados (`data-figma-variant`, `-state`, …) são ignorados: a
 * marca só é lida quando `data-figma` vem seguido de `=` ou `:`, nunca de `-`.
 */
function marcasDoArquivo(conteudo: string): Set<string> {
  const marcas = new Set<string>();
  const padroes = [
    /\bdata-figma\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*(?:"([^"]+)"|'([^']+)')\s*\})/g,
    /["']data-figma["']\s*:\s*(?:"([^"]+)"|'([^']+)')/g,
  ];
  for (const padrao of padroes) {
    for (const achado of conteudo.matchAll(padrao)) {
      const nome = achado[1] ?? achado[2] ?? achado[3] ?? achado[4];
      if (nome) marcas.add(nome);
    }
  }
  return marcas;
}

/** Arquivos `.ts`/`.tsx` de um diretório, recursivamente. */
function arquivosFonte(raiz: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(raiz, { withFileTypes: true })) {
    if (entrada.name.startsWith(".") || entrada.name === "node_modules") continue;
    const caminho = path.join(raiz, entrada.name);
    if (entrada.isDirectory()) saida.push(...arquivosFonte(caminho));
    else if (/\.tsx?$/.test(entrada.name)) saida.push(caminho);
  }
  return saida;
}

/** Caminho relativo à raiz, sempre com `/` (o mesmo formato de `origem.ts`). */
function caminhoRelativo(caminho: string): string {
  return path.relative(ROOT, caminho).split(path.sep).join("/");
}

/* ══════════════════════════════ execução ══════════════════════════════ */

interface Mensagem {
  tipo: string;
  ok?: boolean;
  mensagem?: string;
  texto?: string;
  manifesto?: { scenes: unknown[] };
  nomes?: string[];
  erro?: boolean;
  aviso?: boolean;
}

/** Nó serializado pela leitura de volta (o que o `diff` consome). */
interface NoLeitura {
  tipo: string;
  nome: string;
  descricao?: string;
  ancoraDoComponente?: string | null;
  filhos?: NoLeitura[];
}

interface LeituraFigma {
  pagina: string;
  variaveis: { colecao: string | null; nome: string; tipo: string; valor: unknown }[];
  raizes: NoLeitura[];
}

async function main() {
  const manifesto = path.join(OUT_DIR, "scenes.json");
  if (!existsSync(manifesto)) {
    console.error("Nenhuma cena colhida. Rode antes: npm run figma:harvest");
    process.exit(1);
  }
  const dados = JSON.parse(readFileSync(manifesto, "utf8")) as {
    scenes: { id: string; title: string; group: string; file: string; refImage: string }[];
    tokens?: { cores: Record<string, string>; metricas: Record<string, number> };
  };
  const cenas = dados.scenes;
  console.log(`🧪 Verificando o plugin com ${cenas.length} cenário(s)\n`);

  // Os tokens de design vêm do `globals.css` (fonte única) pelo manifesto: sem
  // eles o plugin não tem como acertar as variáveis do Figma — colheita antiga
  // aqui é falha clara, não aviso.
  if (!dados.tokens?.cores || !dados.tokens?.metricas) {
    problema(
      "o manifesto não traz `tokens` (colheita anterior à fonte única) — rode `npm run figma:harvest`",
    );
  }

  const { figma } = criarFigmaMock();
  const registros = { verificacoes: [] as string[], snapshots: new Map<string, unknown>() };
  const codigo = readFileSync(path.join(TOOL_DIR, "plugin", "code.js"), "utf8");

  // ── estado de uma execução ANTERIOR do plugin ──
  // O upsert só prova alguma coisa se a variável já existir com outro valor: era
  // exatamente esse o defeito (as variáveis ficavam com os tokens antigos
  // copiados no plugin quando o `globals.css` mudava). Por isso as coleções são
  // semeadas com valores desatualizados ANTES da importação.
  const COR_ANTIGA = { r: 1, g: 0, b: 0, a: 1 }; // #ff0000, o brand "de antes"
  const RAIO_ANTIGO = 4;
  const colecaoCorAntiga = figma.variables.createVariableCollection("Nexus / Cor");
  figma.variables
    .createVariable("brand", colecaoCorAntiga, "COLOR")
    .setValueForMode(colecaoCorAntiga.defaultModeId, COR_ANTIGA);
  // uma variável que não está mais na lista de tokens: o upsert não pode removê-la
  figma.variables
    .createVariable("token-que-saiu", colecaoCorAntiga, "COLOR")
    .setValueForMode(colecaoCorAntiga.defaultModeId, { r: 0, g: 0, b: 0, a: 1 });
  const colecaoMetricaAntiga = figma.variables.createVariableCollection("Nexus / Métrica");
  figma.variables
    .createVariable("raio-lg", colecaoMetricaAntiga, "FLOAT")
    .setValueForMode(colecaoMetricaAntiga.defaultModeId, RAIO_ANTIGO);

  const mensagens: Mensagem[] = [];
  const aguardando = new Map<string, { resolver: (m: Mensagem) => void }[]>();

  function esperar(tipo: string, tempoLimite = 120_000) {
    return new Promise<Mensagem>((resolver, rejeitar) => {
      const limite = setTimeout(() => {
        rejeitar(new Error(`tempo esgotado esperando a mensagem "${tipo}"`));
      }, tempoLimite);
      const lista = aguardando.get(tipo) ?? [];
      lista.push({
        resolver: (mensagem) => {
          clearTimeout(limite);
          resolver(mensagem);
        },
      });
      aguardando.set(tipo, lista);
    });
  }

  figma.ui.postMessage = (mensagem: unknown) => {
    const msg = mensagem as Mensagem;
    mensagens.push(msg);
    const lista = aguardando.get(msg.tipo);
    if (lista) {
      aguardando.delete(msg.tipo);
      for (const pendente of lista) pendente.resolver(msg);
    }
  };

  const contexto = {
    figma,
    fetch: criarFetch(OUT_DIR, registros),
    console,
    URL,
    Uint8Array,
    ArrayBuffer,
    Promise,
    Map,
    Set,
    JSON,
    Math,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    decodeURIComponent,
    encodeURIComponent,
    Error,
    RegExp,
    __html__: "",
  };

  vm.createContext(contexto);
  try {
    vm.runInContext(codigo, contexto, { filename: "plugin/code.js" });
  } catch (erro) {
    console.error("❌ O plugin lançou erro ao carregar:", erro);
    process.exit(1);
  }

  const onmessage = figma.ui.onmessage;
  if (!onmessage) {
    console.error("❌ O plugin não registrou figma.ui.onmessage");
    process.exit(1);
  }

  // sonda: confirma que o canal de mensagens do plugin chega até aqui
  const sonda = vm.runInContext(
    "typeof fetch + '|' + typeof figma.ui.postMessage + '|' + typeof figma.createFrame",
    contexto,
  ) as string;
  figma.ui.postMessage({ tipo: "sonda" });
  console.log(`✓ ponte de mensagens ok (${sonda})`);

  // Confere que o mock reproduz o Figma real: um quadro novo nasce com o eixo
  // principal em AUTO, então definir layoutMode faz o quadro abraçar o conteúdo
  // (medido no arquivo real: 224px → 62px).
  const sondaLayout = figma.createFrame();
  sondaLayout.resize(224, 48);
  const sondaTexto = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  sondaTexto.characters = "Dashboard";
  sondaLayout.appendChild(sondaTexto);
  const antesLayout = {
    w: Math.round(sondaLayout.width),
    modo: sondaLayout.primaryAxisSizingMode,
  };
  sondaLayout.layoutMode = "HORIZONTAL";
  const depoisLayout = {
    w: Math.round(sondaLayout.width),
    modo: sondaLayout.primaryAxisSizingMode,
  };
  sondaLayout.remove();
  console.log(
    `✓ emulação de auto-layout: ${antesLayout.w}px (${antesLayout.modo})` +
      ` → ${depoisLayout.w}px após layoutMode`,
  );

  // 1) catálogo
  const esperaCatalogo = esperar("manifesto");
  await onmessage({ type: "carregar", base: "http://localhost:5178/export" });
  const catalogo = await esperaCatalogo;
  if (!catalogo.ok) {
    console.error("❌ Falha ao carregar o manifesto:", JSON.stringify(catalogo));
    process.exit(1);
  }
  console.log(`✓ manifesto carregado (${catalogo.manifesto?.scenes.length} telas)`);

  // 2) importação completa
  const antes = Date.now();
  const esperaFim = esperar("fim", 600_000);
  await onmessage({
    type: "importar",
    base: "http://localhost:5178/export",
    cenas,
    opcoes: {
      modo: "ambos",
      pagina: "Nexus Export",
      substituir: true,
      verificar: true,
    },
  });
  const resultado = await esperaFim;
  const segundos = ((Date.now() - antes) / 1000).toFixed(1);

  console.log(`✓ importação concluída em ${segundos}s → ${resultado.mensagem}`);

  // 3) inventário do que foi construído
  const paginas = figma.root.children;
  let componentes = 0;
  let instancias = 0;
  let textos = 0;
  let quadros = 0;
  let svgs = 0;
  let imagens = 0;
  let comAutoLayout = 0;
  let comGrow = 0;
  const nomesComponentes: string[] = [];

  const contar = (no: No) => {
    if (no.type === "COMPONENT") {
      componentes++;
      nomesComponentes.push(no.name);
    }
    if (no.type === "INSTANCE") instancias++;
    if (no.type === "TEXT") textos++;
    if (no.type === "FRAME") {
      quadros++;
      if (no.layoutMode !== "NONE") comAutoLayout++;
      if (no.layoutGrow > 0) comGrow++;
    }
    const preenchimentos = no.fills as { type?: string }[];
    if (Array.isArray(preenchimentos)) {
      for (const preenchimento of preenchimentos) {
        if (preenchimento && preenchimento.type === "IMAGE") imagens++;
      }
    }
    if (no.name === "svg") svgs++;
    for (const filho of no.children) contar(filho);
  };
  for (const pagina of paginas) contar(pagina);

  console.log("\n── biblioteca ──");
  console.log(`  componentes: ${componentes}`);
  for (const nome of nomesComponentes.sort()) console.log(`    · ${nome}`);
  console.log("\n── telas e nós ──");
  console.log(`  quadros: ${quadros}   (com auto-layout: ${comAutoLayout}, com grow: ${comGrow})`);
  console.log(`  instâncias: ${instancias}`);
  console.log(`  textos: ${textos}`);
  console.log(`  svgs: ${svgs}   imagens: ${imagens}`);
  console.log(`  conferências enviadas: ${registros.verificacoes.length}`);

  console.log("\n── erros de API detectados ──");
  if (problemas.length === 0) {
    console.log("  nenhum");
  } else {
    const resumo = new Map<string, number>();
    for (const p of problemas) resumo.set(p, (resumo.get(p) ?? 0) + 1);
    for (const [mensagem, vezes] of resumo) console.log(`  ✗ (${vezes}×) ${mensagem}`);
  }

  const logsComErro = mensagens.filter((m) => m.tipo === "log" && m.erro);
  if (logsComErro.length) {
    console.log("\n── falhas reportadas pelo plugin ──");
    for (const log of logsComErro.slice(0, 20)) console.log(`  ✗ ${log.texto}`);
  }

  const avisosPlugin = mensagens.filter((m) => m.tipo === "log" && m.aviso);
  if (avisosPlugin.length) {
    console.log("\n── avisos ──");
    for (const log of avisosPlugin.slice(0, 20)) console.log(`  ⚠ ${log.texto}`);
  }

  // 4) prova de que as sobrescritas de texto realmente chegam às instâncias:
  //    textos que só existem em UMA tela têm de aparecer dentro de instâncias.
  const todasInstancias: No[] = [];
  for (const pagina of paginas) coletarInstancias(pagina, todasInstancias);
  const textosEmInstancias = new Set<string>();
  for (const instancia of todasInstancias) {
    for (const texto of coletarTextosMock(instancia)) {
      textosEmInstancias.add(texto.characters);
    }
  }

  const esperados = [
    "Arroz agulhinha tipo 1",
    "Leite integral UHT 1L",
    "Ana Beatriz Souza",
    "Carlos Eduardo Lima",
    "Pesquisar produtos...",
  ];
  console.log("\n── sobrescritas dentro de instâncias ──");
  let ausentes = 0;
  for (const esperado of esperados) {
    const achado = textosEmInstancias.has(esperado);
    if (!achado) ausentes++;
    console.log(`  ${achado ? "✓" : "✗"} ${esperado}`);
  }
  console.log(`  (${textosEmInstancias.size} textos distintos em ${todasInstancias.length} instâncias)`);

  // 5) tamanho exato dos mestres: cada componente tem de ter a largura/altura
  //    medidas no DOM. Foi assim que se descobriu que o auto-layout encolhia
  //    os quadros (layoutMode faz o quadro abraçar o conteúdo).
  const esperadoPorComponente = new Map<string, Set<string>>();
  for (const cena of cenas) {
    const cenaJson = JSON.parse(
      readFileSync(path.join(OUT_DIR, cena.file), "utf8"),
    ) as { root: Record<string, unknown> };
    const visitar = (no: Record<string, unknown>) => {
      const componente = no.componente as string | undefined;
      if (componente) {
        const props = (no.componentProps ?? {}) as Record<string, string>;
        const valores = ["variant", "state", "columns"]
          .filter((dimensao) => props[dimensao])
          .map((dimensao) =>
            dimensao === "columns" ? props[dimensao] + " colunas" : props[dimensao],
          );
        // mesma regra do plugin: componente com filhos posicionados tem a
        // largura no nome (cada largura tem o seu mestre)
        if (!no.layout && Number(no.w) > 0) {
          valores.push(Math.round(Number(no.w)) + " de largura");
        }
        const nome = componente + (valores.length ? " · " + valores.join(" · ") : "");
        // Guarda TODOS os tamanhos reais dessa ocorrência: o mestre pode ser
        // construído a partir de qualquer uma delas (a mais completa), então o
        // que importa é que ele tenha o tamanho de alguma ocorrência real.
        const tamanhos = esperadoPorComponente.get(nome) ?? new Set<string>();
        tamanhos.add(`${Math.round(Number(no.w))}x${Math.round(Number(no.h))}`);
        esperadoPorComponente.set(nome, tamanhos);
      }
      for (const filho of (no.children ?? []) as Record<string, unknown>[]) visitar(filho);
    };
    visitar(cenaJson.root);
  }

  const mestres: No[] = [];
  const coletarMestres = (no: No) => {
    if (no.type === "COMPONENT" || no.type === "COMPONENT_SET") mestres.push(no);
    for (const filho of no.children) coletarMestres(filho);
  };
  for (const pagina of paginas) {
    for (const filho of pagina.children) coletarMestres(filho);
  }
  const icones = mestres.filter((m) => m.name.startsWith("Ícone · "));
  const mestresDeComponentes = mestres.filter((m) => !m.name.startsWith("Ícone · "));

  const larguraViewport = (dados as unknown as { viewport?: { width: number; height: number } })
    .viewport ?? { width: 0, height: 0 };
  const raizesEdit: No[] = [];
  for (const pagina of paginas) {
    for (const no of pagina.children) {
      if (no.name.endsWith("· EDIT")) raizesEdit.push(no);
    }
  }

  console.log("\n── tamanhos ──");
  console.log(`  referências medidas nas cenas: ${esperadoPorComponente.size}`);
  let errados = 0;
  let semReferencia = 0;
  for (const mestre of mestresDeComponentes) {
    const alvo = esperadoPorComponente.get(mestre.name);
    if (!alvo || alvo.size === 0) {
      semReferencia++;
      console.log(`  ? ${mestre.name}: sem tamanho de referência nas cenas`);
      continue;
    }

    const largura = Math.round(mestre.width);
    const altura = Math.round(mestre.height);
    const modo = (mestre as unknown as { layoutMode: string }).layoutMode;
    const primario = (mestre as unknown as { primaryAxisSizingMode: string }).primaryAxisSizingMode;
    const abraca = primario === "AUTO";

    // Componente com hug tem o eixo principal definido pelo conteúdo
    // (rótulo e ícones), então só o eixo fixo é comparável com o DOM.
    let ok: boolean;
    if (abraca && modo === "HORIZONTAL") {
      ok = [...alvo].some((t) => Math.abs(Number(t.split("x")[1]) - altura) <= 1);
    } else if (abraca && modo === "VERTICAL") {
      ok = [...alvo].some((t) => Math.abs(Number(t.split("x")[0]) - largura) <= 1);
    } else {
      ok = alvo.has(`${largura}x${altura}`);
    }

    if (!ok) {
      errados++;
      console.log(
        `  ✗ ${mestre.name}: ${largura}×${altura}` +
          ` (nenhuma ocorrência real tem esse tamanho: ${[...alvo].slice(0, 4).join(", ")})`,
      );
    }
  }
  console.log(
    `  ${mestresDeComponentes.length - errados - semReferencia}/${mestresDeComponentes.length} componentes com o tamanho medido`,
  );

  let telasErradas = 0;
  for (const raiz of raizesEdit) {
    if (
      Math.abs(raiz.width - larguraViewport.width) > 1 ||
      Math.abs(raiz.height - larguraViewport.height) > 1
    ) {
      telasErradas++;
      console.log(
        `  ✗ ${raiz.name}: ${Math.round(raiz.width)}×${Math.round(raiz.height)}` +
          ` (esperado ${larguraViewport.width}×${larguraViewport.height})`,
      );
    }
  }
  console.log(
    `  ${raizesEdit.length - telasErradas}/${raizesEdit.length} telas no tamanho do viewport` +
      ` (${larguraViewport.width}×${larguraViewport.height})`,
  );

  // 6) Button: precisa expor as propriedades de ícone (esquerda, direita, nenhum,
  //    só ícone) em vez de trazer o ícone embutido no mestre.
  const mestresButton = mestres.filter((m) => m.name.startsWith("Button"));
  const definicoesButton = mestresButton.length
    ? Object.keys((mestresButton[0] as unknown as NoComponente).componentPropertyDefinitions)
    : [];
  const exigidas = [
    "Rótulo",
    "Mostrar rótulo",
    "Mostrar ícone à esquerda",
    "Mostrar ícone à direita",
    "Ícone esquerdo",
    "Ícone direito",
  ];
  const faltando = exigidas.filter((nome) => !definicoesButton.some((d) => d.startsWith(nome + "#")));

  const paginaTelas = paginas.find((p) => p.name === "Nexus Export");
  let botoesComIcone = 0;
  let botoesSemIcone = 0;
  if (paginaTelas) {
    for (const no of coletarInstancias(paginaTelas, [])) {
      if (no.type !== "INSTANCE" || !(no as NoInstancia).mestre) continue;
      if (!(no as NoInstancia).mestre!.name.startsWith("Button")) continue;
      const esquerdo = no.children.find((c) => c.name === "Ícone esquerdo");
      if (!esquerdo) continue;
      if (esquerdo.visible) botoesComIcone++;
      else botoesSemIcone++;
    }
  }

  // 6) Cada elemento do DOM tem de aparecer UMA vez na cena. Um nó içado que
  //    volta para o pai (modais/avisos de posição fixa) entra duplicado — foi
  //    assim que apareceu o modal repetido nas telas de edição.
  let duplicados = 0;
  const exemplosDuplicados: string[] = [];
  for (const cena of cenas) {
    const cenaJson = JSON.parse(readFileSync(path.join(OUT_DIR, cena.file), "utf8")) as {
      root: Record<string, unknown>;
    };
    const vistos = new Set<number>();
    const visitar = (no: Record<string, unknown>) => {
      const id = no.n as number | undefined;
      if (typeof id === "number") {
        if (vistos.has(id)) {
          duplicados++;
          if (exemplosDuplicados.length < 5) {
            exemplosDuplicados.push(`${cena.id} → ${String(no.name)} (n=${id})`);
          }
        }
        vistos.add(id);
      }
      for (const filho of (no.children ?? []) as Record<string, unknown>[]) visitar(filho);
    };
    visitar(cenaJson.root);
  }
  console.log("\n── duplicação ──");
  console.log(`  elementos repetidos nas cenas: ${duplicados}`);
  for (const exemplo of exemplosDuplicados) console.log(`    · ${exemplo}`);

  // 6.5) A VOLTA: ler uma página do Figma e conferir o que o plugin serializa.
  //      É o caminho do `figma:diff`; sem esta prova, a volta só seria testada
  //      quando alguém a tentasse dentro do Figma.
  const esperaPaginas = esperar("paginas");
  await onmessage({ type: "paginas" });
  const paginasVistas = (await esperaPaginas).nomes ?? [];

  const paginaLida = "Nexus Export";
  const esperaLeitura = esperar("leitura", 300_000);
  await onmessage({ type: "ler", pagina: paginaLida, base: "http://localhost:5178/export" });
  const leitura = await esperaLeitura;
  const snapshot = registros.snapshots.get(paginaLida) as LeituraFigma | undefined;

  const contarTipo = (no: NoLeitura, tipo: string): number =>
    (no.tipo === tipo ? 1 : 0) +
    (no.filhos ?? []).reduce((total, filho) => total + contarTipo(filho, tipo), 0);
  const acharAncora = (no: NoLeitura): string | null => {
    if (no.tipo === "INSTANCE" && typeof no.ancoraDoComponente === "string") return no.ancoraDoComponente;
    for (const filho of no.filhos ?? []) {
      const achado = acharAncora(filho);
      if (achado) return achado;
    }
    return null;
  };

  const raizesLidas = snapshot?.raizes ?? [];
  const instanciasLidas = raizesLidas.reduce((total, raiz) => total + contarTipo(raiz, "INSTANCE"), 0);
  const ancoras: string[] = [];
  for (const raiz of raizesLidas) {
    const ancora = acharAncora(raiz);
    if (ancora && ancora.indexOf("Origem: src/") === 0) ancoras.push(ancora);
  }
  const variaveisLidas = snapshot?.variaveis ?? [];
  const brand = variaveisLidas.find((variavel) => variavel.nome === "brand");
  const quadrosEdit = raizesLidas.filter((no) => no.nome.endsWith(" · EDIT")).length;

  const problemasDaVolta: string[] = [];
  if (!leitura.ok) problemasDaVolta.push(`o envio falhou: ${leitura.mensagem}`);
  if (!paginasVistas.includes(paginaLida)) problemasDaVolta.push(`a página "${paginaLida}" não apareceu na listagem`);
  if (!snapshot) problemasDaVolta.push("o plugin não enviou o snapshot");
  if (!raizesLidas.length) problemasDaVolta.push("o snapshot veio sem nós na raiz");
  if (!quadrosEdit) problemasDaVolta.push("nenhum quadro `· EDIT` foi lido");
  if (!instanciasLidas) problemasDaVolta.push("nenhuma instância foi serializada");
  if (!ancoras.length) problemasDaVolta.push("nenhuma instância trouxe a âncora de código (Origem: src/…)");
  if (!variaveisLidas.length) problemasDaVolta.push("nenhuma variável foi lida");
  if (!brand || typeof brand.valor !== "string") problemasDaVolta.push("a variável `brand` não veio com valor");

  console.log("\n── volta (Figma → app) ──");
  console.log(`  páginas listadas: ${paginasVistas.join(" · ")}`);
  console.log(`  "${paginaLida}": ${raizesLidas.length} nó(s) na raiz, ${quadrosEdit} quadro(s) · EDIT`);
  console.log(`  instâncias serializadas: ${instanciasLidas}`);
  console.log(`  âncoras de código nas instâncias: ${ancoras.length}`);
  for (const ancora of [...new Set(ancoras)].slice(0, 3)) console.log(`    · ${ancora}`);
  console.log(`  variáveis lidas: ${variaveisLidas.length} (brand = ${String(brand?.valor ?? "—")})`);
  for (const mensagem of problemasDaVolta) console.log(`  ✗ ${mensagem}`);

  // 6.9) TOKENS: a fonte única é o `globals.css` (levado no manifesto) e o
  //      plugin faz UPSERT nas variáveis. A prova tem duas partes:
  //        a) as variáveis de `Nexus / Cor` e `Nexus / Métrica` batem com os
  //           tokens do manifesto;
  //        b) a importação foi rodada sobre coleções semeadas com valores
  //           ANTIGOS (ver o topo de `main`): cada variável pré-existente tem de
  //           ter CONVERGIDO para o valor atual — antes desta mudança os tokens
  //           viviam copiados no plugin e ficavam desatualizados.
  //      Variável que saiu da lista de tokens é mantida (só registrada).
  type VariavelLocal = Awaited<ReturnType<typeof figma.variables.getLocalVariablesAsync>>[number];
  const tokenCores = dados.tokens?.cores ?? {};
  const tokenMetricas = dados.tokens?.metricas ?? {};

  const paraRgba = (hex: string) => {
    const n = Number.parseInt(hex.replace("#", ""), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  };

  const colecoesFinais = await figma.variables.getLocalVariableCollectionsAsync();
  const variaveisFinais = await figma.variables.getLocalVariablesAsync();
  const colecaoFinal = (nomeColecao: string) => colecoesFinais.find((c) => c.name === nomeColecao) ?? null;
  const variaveisDa = (nomeColecao: string): VariavelLocal[] => {
    const colecao = colecaoFinal(nomeColecao);
    if (!colecao) return [];
    return variaveisFinais.filter((v) => v.variableCollectionId === colecao.id);
  };

  let tokensDivergentes = 0;
  const exemplosTokens: string[] = [];
  const problemasDeTokens: string[] = [];

  const corFinal = variaveisDa("Nexus / Cor");
  const metricaFinal = variaveisDa("Nexus / Métrica");
  const colecaoCorFinal = colecaoFinal("Nexus / Cor");
  const colecaoMetricaFinal = colecaoFinal("Nexus / Métrica");
  if (!colecaoCorFinal) problemasDeTokens.push("a coleção `Nexus / Cor` não existe");
  if (!colecaoMetricaFinal) problemasDeTokens.push("a coleção `Nexus / Métrica` não existe");

  for (const [chave, hex] of Object.entries(tokenCores)) {
    const variavel = corFinal.find((v) => v.name === chave);
    if (!variavel) {
      tokensDivergentes++;
      exemplosTokens.push(`Nexus / Cor · ${chave}: variável ausente`);
      continue;
    }
    const valor = variavel.valuesByMode[colecaoCorFinal?.defaultModeId ?? ""] as
      | { r: number; g: number; b: number }
      | undefined;
    const alvo = paraRgba(hex);
    const bate =
      !!valor &&
      Math.abs(valor.r - alvo.r) < 0.004 &&
      Math.abs(valor.g - alvo.g) < 0.004 &&
      Math.abs(valor.b - alvo.b) < 0.004;
    if (!bate) {
      tokensDivergentes++;
      exemplosTokens.push(
        `Nexus / Cor · ${chave}: ${valor ? JSON.stringify(valor) : "sem valor"} ≠ ${hex}`,
      );
    }
  }
  for (const [chave, esperado] of Object.entries(tokenMetricas)) {
    const variavel = metricaFinal.find((v) => v.name === chave);
    if (!variavel) {
      tokensDivergentes++;
      exemplosTokens.push(`Nexus / Métrica · ${chave}: variável ausente`);
      continue;
    }
    const valor = variavel.valuesByMode[colecaoMetricaFinal?.defaultModeId ?? ""];
    if (typeof valor !== "number" || Math.abs(valor - esperado) > 0.01) {
      tokensDivergentes++;
      exemplosTokens.push(`Nexus / Métrica · ${chave}: ${String(valor)} ≠ ${esperado}`);
    }
  }

  // a variável semeada antes da importação estava com #ff0000: continuar com
  // esse valor significa que o upsert NÃO atualizou a existente (o defeito)
  const brandAtual = corFinal.find((v) => v.name === "brand");
  const brandAtualValor = brandAtual?.valuesByMode[colecaoCorFinal?.defaultModeId ?? ""] as
    | { r: number; g: number; b: number }
    | undefined;
  const manteveValorAntigo =
    !!brandAtualValor &&
    Math.abs(brandAtualValor.r - COR_ANTIGA.r) < 0.004 &&
    Math.abs(brandAtualValor.g - COR_ANTIGA.g) < 0.004 &&
    Math.abs(brandAtualValor.b - COR_ANTIGA.b) < 0.004;
  if (!tokenCores.brand) {
    problemasDeTokens.push("o manifesto não traz o token `brand`");
  } else if (manteveValorAntigo) {
    problemasDeTokens.push(
      "`brand` continuou com o valor antigo (#ff0000) — o upsert não atualizou a variável existente",
    );
  }
  const raioAtual = metricaFinal.find((v) => v.name === "raio-lg");
  const raioAtualValor = raioAtual?.valuesByMode[colecaoMetricaFinal?.defaultModeId ?? ""];
  if (raioAtualValor === RAIO_ANTIGO && tokenMetricas["raio-lg"] !== RAIO_ANTIGO) {
    problemasDeTokens.push(
      "`raio-lg` continuou com o valor antigo (4) — o upsert não atualizou a variável existente",
    );
  }
  const fantasma = corFinal.find((v) => v.name === "token-que-saiu");
  if (!fantasma) {
    problemasDeTokens.push("a variável fora da lista de tokens foi REMOVIDA (o upsert não remove)");
  }
  if (!mensagens.some((m) => m.tipo === "log" && m.aviso && (m.texto ?? "").indexOf("token-que-saiu") >= 0)) {
    problemasDeTokens.push("a variável fora da lista de tokens não foi registrada no log");
  }
  if (tokensDivergentes > 0) {
    problemasDeTokens.push(`${tokensDivergentes} variável(is) divergente(s) dos tokens do manifesto`);
  }

  console.log("\n── tokens (variáveis do Figma) ──");
  console.log(
    `  esperados pelo manifesto: ${Object.keys(tokenCores).length} cor(es), ${Object.keys(tokenMetricas).length} métrica(s)`,
  );
  console.log(
    `  Nexus / Cor: ${corFinal.length} variável(is) · Nexus / Métrica: ${metricaFinal.length} variável(is)`,
  );
  console.log(
    `  convergência: brand #ff0000 → ${brandAtualValor ? `#${[brandAtualValor.r, brandAtualValor.g, brandAtualValor.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}` : "—"}` +
      ` · raio-lg ${RAIO_ANTIGO} → ${String(raioAtualValor ?? "—")}`,
  );
  console.log(`  variáveis fora dos tokens (mantidas): ${fantasma ? "token-que-saiu" : "(nenhuma)"}`);
  console.log(`  divergências: ${tokensDivergentes}`);
  for (const exemplo of exemplosTokens.slice(0, 6)) console.log(`    · ${exemplo}`);
  for (const mensagem of problemasDeTokens) console.log(`  ✗ ${mensagem}`);

  // 7) Componente com filhos POSICIONADOS (sem auto-layout) não reflui ao ser  //    redimensionado. Então a instância precisa ter EXATAMENTE a largura do
  //    mestre — foi por isso que a paginação aparecia deslocada e cortada nos
  //    modais (mestre de 1070 usado numa tabela de 664).
  let largurasIncompativeis = 0;
  const mestresAninhados: string[] = [];
  // Todo mestre precisa da âncora de origem na descrição: `Origem: <arquivo>`.
  // É ela que o `figma:diff` lê para dizer em qual arquivo do app mexer quando o
  // design muda — sem ela a volta fica cega, e "(não mapeada)" significa que o
  // componente saiu no app sem entrada em `origem.ts`.
  let semAncora = 0;
  const exemplosSemAncora: string[] = [];
  const exemplosLargura: string[] = [];
  const conferir = (no: No) => {
    // Um mestre vive na página ou dentro de uma seção (pacote) — nunca dentro
    // de um frame, instância ou de outro componente.
    if (no.type === "COMPONENT") {
      const pai = no.parent;
      if (!pai || (pai.type !== "PAGE" && pai.type !== "SECTION")) {
        mestresAninhados.push(no.name);
      }
      if (no.description.indexOf("Origem: ") !== 0 || no.description.indexOf("Origem: (não mapeada)") === 0) {
        semAncora++;
        if (exemplosSemAncora.length < 6) exemplosSemAncora.push(no.name || "(sem nome)");
      }
    }
    if (no.type === "INSTANCE") {
      const mestre = (no as unknown as NoInstancia).mestre;
      if (mestre && mestre.type === "COMPONENT" && mestre.layoutMode === "NONE") {
        if (Math.abs(no.width - mestre.width) > 1) {
          largurasIncompativeis++;
          if (exemplosLargura.length < 6) {
            exemplosLargura.push(
              `${no.name}: instância ${Math.round(no.width)} · mestre ${Math.round(mestre.width)}`,
            );
          }
        }
      }
    }
    for (const filho of no.children) conferir(filho);
  };
  for (const pagina of paginas) {
    for (const filho of pagina.children) conferir(filho);
  }

  // 8) Texto de campo de formulário precisa ficar CENTRALIZADO na vertical. O
  //    ramo de largura automática vencia o `CENTER` e o texto subia ~7px.
  let camposDesalinhados = 0;
  const conferirCampos = (no: No) => {
    if (no.type === "FRAME" && ["input", "textarea", "select"].includes(no.name)) {
      for (const filho of no.children) {
        if (filho.type === "TEXT") {
          const texto = filho as unknown as { textAlignVertical?: string };
          if (texto.textAlignVertical !== "CENTER") camposDesalinhados++;
        }
      }
    }
    for (const filho of no.children) conferirCampos(filho);
  };
  for (const pagina of paginas) conferirCampos(pagina);

  const formulariosSemFundo = mestresDeComponentes
    .filter((m) => m.name.startsWith("Formulario") && (!m.fills || m.fills.length === 0))
    .map((m) => m.name);

  // ── pacotes, vazamento e setas da paginação ──

  // Cada pacote (seção) tem de comportar TODOS os seus mestres: a largura era
  // calculada só pela última linha e as linhas de cima vazavam para fora.
  let mestresForaDoPacote = 0;
  const exemplosForaDoPacote: string[] = [];
  for (const pagina of paginas) {
    for (const secao of pagina.children.filter((n) => n.type === "SECTION")) {
      for (const filho of secao.children) {
        if (filho.x + filho.width - secao.width > 3 || filho.y + filho.height - secao.height > 3) {
          mestresForaDoPacote++;
          if (exemplosForaDoPacote.length < 6) {
            exemplosForaDoPacote.push(
              `${secao.name} (${Math.round(secao.width)}x${Math.round(secao.height)})` +
                ` ← ${filho.name} até ${Math.round(filho.x + filho.width)}x${Math.round(filho.y + filho.height)}`,
            );
          }
        }
      }
    }
  }

  // Mestre com filhos POSICIONADOS (sem auto-layout) não pode ter filho passando
  // da borda: era o caso da paginação estreita (436/456) recebendo a posição da
  // de 1070.
  let mestresComVazamento = 0;
  const exemplosVazamento: string[] = [];
  for (const mestre of mestresDeComponentes) {
    if (mestre.layoutMode !== "NONE") continue;
    for (const filho of mestre.children) {
      if (filho.x + filho.width - mestre.width > 3 || filho.y + filho.height - mestre.height > 3) {
        mestresComVazamento++;
        if (exemplosVazamento.length < 6) {
          exemplosVazamento.push(
            `${mestre.name} (${Math.round(mestre.width)}x${Math.round(mestre.height)})` +
              ` ← ${filho.name} até ${Math.round(filho.x + filho.width)}`,
          );
        }
      }
    }
  }

  // Os 4 botões de paginação têm setas DIFERENTES: precisam ser 4 variantes.
  const pageButtons = mestres.filter((m) => m.name.startsWith("PageButton")).map((m) => m.name);
  const setasEsperadas = ["Primeira página", "Página anterior", "Próxima página", "Última página"];
  const setasFaltando = setasEsperadas.filter(
    (seta) => !pageButtons.some((nome) => nome.indexOf(seta) >= 0),
  );

  console.log("\n── componentes ──");
  console.log(`  campos de formulário com texto não centralizado: ${camposDesalinhados}`);
  console.log(`  formulários sem fundo próprio: ${formulariosSemFundo.length}`);
  if (formulariosSemFundo.length) {
    console.log(`    · ${formulariosSemFundo.slice(0, 6).join(", ")}`);
  }
  console.log(`  mestres vazando do pacote: ${mestresForaDoPacote}`);
  for (const exemplo of exemplosForaDoPacote) console.log(`    · ${exemplo}`);
  console.log(`  mestres com filho passando da borda (sem auto-layout): ${mestresComVazamento}`);
  for (const exemplo of exemplosVazamento) console.log(`    · ${exemplo}`);
  console.log(`  variantes de PageButton: ${pageButtons.length} → ${pageButtons.join(", ")}`);
  if (setasFaltando.length) console.log(`  ✗ setas faltando: ${setasFaltando.join(", ")}`);
  console.log(`  instâncias com largura diferente do mestre (sem auto-layout): ${largurasIncompativeis}`);
  for (const exemplo of exemplosLargura) console.log(`    · ${exemplo}`);
  console.log(`  mestres fora do nível da página: ${mestresAninhados.length}`);
  for (const nome of mestresAninhados.slice(0, 5)) console.log(`    · ${nome}`);
  console.log(`  mestres sem âncora de origem: ${semAncora}`);
  for (const nome of exemplosSemAncora) console.log(`    · ${nome}`);
  if (semAncora > 0) {
    console.log("    → o manifesto é anterior à tabela de origens: rode `npm run figma:harvest`");
  }

  console.log("\n── páginas ──");
  let soltosNaBiblioteca = 0;
  let sobreposicoesNaBiblioteca = 0;
  const paginasDaBiblioteca: { nome: string; secoes: string[] }[] = [];
  for (const pagina of paginas) {
    const ehBiblioteca = pagina.name !== "Nexus Export";
    const soltos = pagina.children.filter(
      (n) => n.type !== "COMPONENT" && n.type !== "COMPONENT_SET" && n.type !== "SECTION",
    );
    if (ehBiblioteca) {
      soltosNaBiblioteca += soltos.length;
      const filhos = pagina.children;
      for (let i = 0; i < filhos.length; i++) {
        for (let j = i + 1; j < filhos.length; j++) {
          const a = filhos[i];
          const b = filhos[j];
          const separados =
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y;
          if (!separados) sobreposicoesNaBiblioteca++;
        }
      }
      paginasDaBiblioteca.push({
        nome: pagina.name,
        secoes: filhos.filter((n) => n.type === "SECTION").map((n) => n.name),
      });
    }
    console.log(
      `  ${pagina.name}: ${pagina.children.length} filhos` +
        (ehBiblioteca && soltos.length ? ` — ${soltos.length} não-componente` : ""),
    );
  }
  for (const pagina of paginasDaBiblioteca) {
    console.log(`  pacotes em ${pagina.nome}: ${pagina.secoes.length} → ${pagina.secoes.join(" · ")}`);
  }
  console.log(
    `  biblioteca: ${soltosNaBiblioteca} nó(s) solto(s), ${sobreposicoesNaBiblioteca} sobreposição(ões)`,
  );

  console.log("\n── Button ──");
  console.log(`  mestres: ${mestresButton.map((m) => m.name).join(", ") || "(nenhum)"}`);
  console.log(`  propriedades: ${definicoesButton.map((d) => d.split("#")[0]).join(", ") || "(nenhuma)"}`);
  console.log(`  ícones na biblioteca: ${icones.length}`);
  console.log(`  instâncias: ${botoesComIcone} com ícone à esquerda, ${botoesSemIcone} sem ícone`);
  if (faltando.length) console.log(`  ✗ faltando: ${faltando.join(", ")}`);

  const secoesDaBiblioteca = paginasDaBiblioteca.flatMap((p) => p.secoes);  const pacotesEsperados = [
    "Botões",
    "Formulários",
    "Sidebar",
    "Tabelas",
    "Navegação e retorno",
    "Ícones",
  ];
  const pacotesFaltando = pacotesEsperados.filter((nome) => !secoesDaBiblioteca.includes(nome));
  if (pacotesFaltando.length) {
    console.log(`  ✗ pacotes faltando: ${pacotesFaltando.join(", ")}`);
  }

  // 13) O painel (`ui.html`) e o plugin precisam estar de acordo: um `id` digitado
  //     errado é um botão morto, e isso só apareceria dentro do Figma.
  const painel = readFileSync(path.join(TOOL_DIR, "plugin", "ui.html"), "utf8");
  const idsNoPainel = new Set([...painel.matchAll(/id="([^"]+)"/g)].map((achado) => achado[1]));
  const idsUsados = [...new Set([...painel.matchAll(/\$\("([^"]+)"\)/g)].map((achado) => achado[1]))];
  const idsSemElemento = idsUsados.filter((id) => !idsNoPainel.has(id));
  const scriptDoPainel = painel.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
  let erroNoPainel: string | null = null;
  try {
    new vm.Script(scriptDoPainel);
  } catch (erro) {
    erroNoPainel = erro instanceof Error ? erro.message : String(erro);
  }

  console.log("\n── painel (ui.html) ──");
  console.log(`  ids: ${idsNoPainel.size} no html, ${idsUsados.length} usados pelo script`);
  console.log(`  script do painel: ${scriptDoPainel ? "analisado" : "não encontrado"}`);
  if (idsSemElemento.length) console.log(`  ✗ ids sem elemento: ${idsSemElemento.join(", ")}`);
  if (erroNoPainel) console.log(`  ✗ erro de sintaxe no script: ${erroNoPainel}`);
  if (!scriptDoPainel) console.log("  ✗ o ui.html não tem <script>");

  // 13) Guarda de reuso: todo componente promovido precisa continuar MARCADO no
  //     código. O `data-figma` é o único vínculo entre a UI e o design e não tem
  //     efeito visual, então some numa refatoração sem ninguém notar — o
  //     componente deixa de ser promovido e a tela perde o reuso. Aqui isso vira
  //     falha (e não aviso), porque o componente promovido existe *por causa*
  //     da marca. Marca sem âncora em ORIGEM é o inverso: aviso, não falha.
  const promovidos = vm.runInContext("COMPONENTES", contexto) as string[];
  let comAncora = 0;
  let comMarca = 0;
  const semMarca: string[] = [];
  for (const nome of promovidos) {
    const arquivo = ORIGEM[nome];
    if (!arquivo) {
      problema(`marca (reuso): "${nome}" está em COMPONENTES mas não tem âncora em ORIGEM`);
      semMarca.push(`${nome} (sem âncora em ORIGEM)`);
      continue;
    }
    comAncora++;
    const caminho = path.join(ROOT, arquivo);
    if (!existsSync(caminho)) {
      problema(`marca (reuso): a âncora de "${nome}" aponta para arquivo inexistente: ${arquivo}`);
      semMarca.push(`${nome} (arquivo ausente: ${arquivo})`);
      continue;
    }
    if (!marcasDoArquivo(readFileSync(caminho, "utf8")).has(nome)) {
      problema(`marca (reuso): "${nome}" perdeu o data-figma em ${arquivo}`);
      semMarca.push(`${nome} (${arquivo})`);
      continue;
    }
    comMarca++;
  }

  const marcadosNoApp = new Map<string, string[]>();
  for (const arquivo of arquivosFonte(path.join(ROOT, "src"))) {
    for (const nome of marcasDoArquivo(readFileSync(arquivo, "utf8"))) {
      const arquivos = marcadosNoApp.get(nome) ?? [];
      arquivos.push(caminhoRelativo(arquivo));
      marcadosNoApp.set(nome, arquivos);
    }
  }
  const avisosDeReuso: string[] = [];
  for (const nome of [...marcadosNoApp.keys()].filter((n) => !ORIGEM[n]).sort()) {
    const aviso = `marca (reuso): "${nome}" aparece em ${marcadosNoApp.get(nome)!.join(", ")} mas não tem âncora em ORIGEM`;
    avisosDeReuso.push(aviso);
    avisos.push(aviso);
  }

  console.log("\n── marcas (reuso) ──");
  console.log(
    `  componentes promovidos: ${promovidos.length} · com âncora em ORIGEM: ${comAncora} · com marca no código: ${comMarca}`,
  );
  for (const entrada of semMarca) console.log(`  ✗ ${entrada}`);
  for (const aviso of avisosDeReuso) console.log(`  ⚠ ${aviso}`);
  console.log(
    `  ${comMarca}/${promovidos.length} promovidos com a marca` +
      (avisosDeReuso.length ? ` · ${avisosDeReuso.length} marca(s) sem âncora (aviso)` : ""),
  );

  // 14) FIDELIDADE DA MONTAGEM — quatro defeitos de reconstrução (KAN-166).
  //
  //     Cada regra existe porque o Figma não é o navegador: o auto-layout dele não
  //     tem PESO de `flex-grow`; um texto re-quebra pela largura da caixa; um mestre
  //     vem de UMA ocorrência (a mais completa); e "Fill" divide a sobra por igual.
  //     As regras valem sobre as CENAS (o que a colheita mediu) e sobre a árvore
  //     construída.
  let framesComDoisGrow = 0; // (a) com dois filhos que crescem, o Figma divide igual
  let growComSobra = 0; // (b) sobra no eixo principal = marca de invólucro colapsado
  let paginacaoQuebrada = 0; // (c) "1 de 0" em duas linhas na cena
  let paginacaoRequebra = 0; // (c) texto de paginação que o Figma pode re-quebrar
  let geometriaDeInstancia = 0; // (d) filho de instância com tamanho de outra ocorrência
  const exemplosMontagem: string[] = [];
  const registrarMontagem = (texto: string) => {
    if (exemplosMontagem.length < 12) exemplosMontagem.push(texto);
  };

  const visitarMontagem = (
    no: Record<string, unknown>,
    cenaId: string,
    caminho: string,
  ): void => {
    const filhos = (no.children ?? []) as Record<string, unknown>[];
    const layout = no.layout as { mode: string; gap: number; padding: number[] } | undefined;

    if (layout) {
      const horizontal = layout.mode === "HORIZONTAL";
      const crescem = filhos.filter((filho) => filho.grow);

      // (a) O Figma divide a sobra IGUALMENTE entre os filhos que crescem, então
      //     uma proporção 2:1 do CSS viraria 1:1 — foi o que encolheu a coluna do
      //     CEP para 210 e pôs o select da UF por cima do botão da lupa.
      if (crescem.length > 1) {
        framesComDoisGrow++;
        registrarMontagem(`(a) ${cenaId} ${caminho}: ${crescem.length} filhos com grow`);
      }

      // (b) Um filho que cresce ABSORVE a sobra: se sobrou espaço, a marca não é
      //     deste pai — veio de um invólucro colapsado e vale outro eixo aqui (um
      //     campo `flex-1` de linha horizontal passava a "crescer na vertical").
      if (crescem.length) {
        const principal = horizontal ? Number(no.w) : Number(no.h);
        const padding = horizontal
          ? layout.padding[1] + layout.padding[3]
          : layout.padding[0] + layout.padding[2];
        let conteudo = 0;
        for (const filho of filhos) conteudo += horizontal ? Number(filho.w) : Number(filho.h);
        const sobra =
          principal - padding - conteudo - layout.gap * Math.max(0, filhos.length - 1);
        if (sobra > 2.5) {
          growComSobra++;
          registrarMontagem(
            `(b) ${cenaId} ${caminho}: filho com grow e ${Math.round(sobra)}px de sobra`,
          );
        }
      }
    }

    // (c) A informação da paginação é curta e não pode quebrar linha.
    const texto = no.text as { value?: string; singleLine?: boolean } | undefined;
    if (texto && /^\d+ de \d+$/.test(String(texto.value)) && texto.singleLine !== true) {
      paginacaoQuebrada++;
      registrarMontagem(`(c) ${cenaId} ${caminho}: "${String(texto.value)}" em duas linhas`);
    }

    for (const filho of filhos) {
      visitarMontagem(filho, cenaId, `${caminho}/${String(filho.name)}`);
    }
  };

  for (const cena of cenas) {
    const cenaJson = JSON.parse(readFileSync(path.join(OUT_DIR, cena.file), "utf8")) as {
      root: Record<string, unknown>;
    };
    visitarMontagem(cenaJson.root, cena.id, "");
  }

  // (c) na árvore: o texto de paginação precisa sair com largura automática
  //     (`WIDTH_AND_HEIGHT`) — com `HEIGHT` o Figma re-quebra pela largura da caixa
  //     e o "0" cai para a linha de baixo.
  const conferirPaginacao = (no: No) => {
    if (no.type === "TEXT") {
      const texto = no as unknown as NoTexto;
      if (/^\d+ de \d+$/.test(texto.characters) && texto.textAutoResize !== "WIDTH_AND_HEIGHT") {
        paginacaoRequebra++;
        registrarMontagem(`(c) árvore: "${texto.characters}" com auto-resize ${texto.textAutoResize}`);
      }
    }
    for (const filho of no.children) conferirPaginacao(filho);
  };
  for (const pagina of paginas) {
    for (const raiz of pagina.children) conferirPaginacao(raiz);
  }

  // (d) Dentro de uma instância, o filho tem o tamanho da ocorrência DESTA tela: o
  //     mestre vem da ocorrência mais completa, e a altura de um contêiner de texto
  //     (a mensagem do `ConfirmDialog`) escorregava de lá, empurrando a barra de
  //     botões para baixo. Filho com `grow`/`hug` fica de fora: nesses o tamanho é
  //     do auto-layout, não da ocorrência.
  const paresDeFilhos = (
    nos: No[],
    specs: Record<string, unknown>[],
  ): [No, Record<string, unknown>][] => {
    const saida: [No, Record<string, unknown>][] = [];
    let i = 0;
    let j = 0;
    while (i < nos.length && j < specs.length) {
      const esperado = specs[j].kind === "text" ? "text" : "caixa";
      let k = i;
      while (k < nos.length && (nos[k].type === "TEXT" ? "text" : "caixa") !== esperado) k++;
      if (k >= nos.length) {
        j++;
        continue;
      }
      saida.push([nos[k], specs[j]]);
      i = k + 1;
      j++;
    }
    return saida;
  };

  const conferirGeometria = (
    no: No,
    spec: Record<string, unknown>,
    dentroDeInstancia: boolean,
    cenaId: string,
    caminho: string,
  ): void => {
    const layout = spec.layout as { hug?: boolean } | undefined;
    if (dentroDeInstancia && no.type === "FRAME" && !spec.grow && layout?.hug !== true) {
      // A largura de um contêiner de texto acompanha o texto (cada tela tem o seu);
      // a altura é que não pode vir de outra ocorrência.
      const temTexto = no.children.some((filho) => filho.type === "TEXT");
      const difereAltura = Math.abs(no.height - Number(spec.h)) > 1;
      const difereLargura = !temTexto && Math.abs(no.width - Number(spec.w)) > 1;
      if (difereAltura || difereLargura) {
        geometriaDeInstancia++;
        registrarMontagem(
          `(d) ${cenaId} ${caminho}: instância ${Math.round(no.width)}×${Math.round(no.height)}` +
            ` · cena ${spec.w}×${spec.h}`,
        );
      }
    }
    const specs = (spec.children ?? []) as Record<string, unknown>[];
    const aninhado = dentroDeInstancia || no.type === "INSTANCE";
    for (const [filho, filhoSpec] of paresDeFilhos(no.children, specs)) {
      conferirGeometria(filho, filhoSpec, aninhado, cenaId, `${caminho}/${String(filhoSpec.name)}`);
    }
  };

  for (const raiz of raizesEdit) {
    const cena = cenas.find((c) => `${c.id} · EDIT` === raiz.name);
    if (!cena) continue;
    const cenaJson = JSON.parse(readFileSync(path.join(OUT_DIR, cena.file), "utf8")) as {
      root: Record<string, unknown>;
    };
    conferirGeometria(raiz, cenaJson.root, false, cena.id, cena.id);
  }

  console.log("\n── fidelidade da montagem (KAN-166) ──");
  console.log(`  frames com mais de um filho que cresce: ${framesComDoisGrow}`);
  console.log(`  filho que cresce com sobra no eixo principal: ${growComSobra}`);
  console.log(`  textos de paginação em duas linhas (cena): ${paginacaoQuebrada}`);
  console.log(`  textos de paginação que o Figma pode re-quebrar: ${paginacaoRequebra}`);
  console.log(`  filhos de instância com o tamanho de outra ocorrência: ${geometriaDeInstancia}`);
  for (const exemplo of exemplosMontagem) console.log(`    · ${exemplo}`);

  const falhou =
    problemas.length > 0 ||
    !resultado.ok ||
    logsComErro.length > 0 ||
    ausentes > 0 ||
    errados > 0 ||
    semReferencia > 0 ||
    telasErradas > 0 ||
    faltando.length > 0 ||
    icones.length === 0 ||
    botoesComIcone === 0 ||
    botoesSemIcone === 0 ||
    soltosNaBiblioteca > 0 ||
    sobreposicoesNaBiblioteca > 0 ||
    duplicados > 0 ||
    largurasIncompativeis > 0 ||
    mestresAninhados.length > 0 ||
    semAncora > 0 ||
    camposDesalinhados > 0 ||
    formulariosSemFundo.length > 0 ||
    pacotesFaltando.length > 0 ||
    mestresForaDoPacote > 0 ||
    mestresComVazamento > 0 ||
    problemasDaVolta.length > 0 ||
    problemasDeTokens.length > 0 ||
    idsSemElemento.length > 0 ||
    erroNoPainel !== null ||
    scriptDoPainel === "" ||
    semMarca.length > 0 ||
    setasFaltando.length > 0 ||
    framesComDoisGrow > 0 ||
    growComSobra > 0 ||
    paginacaoQuebrada > 0 ||
    paginacaoRequebra > 0 ||
    geometriaDeInstancia > 0;
  console.log("");
  console.log(falhou ? "❌ verificação encontrou problemas" : "✅ plugin verificado sem problemas");
  process.exit(falhou ? 1 : 0);
}

main().catch((erro) => {
  console.error("Falha na verificação:", erro);
  process.exit(1);
});
