/**
 * Nexus Export — plugin local do Figma.
 *
 * Reconstrói as telas da aplicação como uma biblioteca de **componentes
 * reutilizáveis com propriedades** + instâncias por tela, ao lado da captura
 * 1:1 de referência.
 *
 * Funciona em duas passadas:
 *   A. biblioteca — cria as variáveis (tokens do globals.css) e os componentes
 *      mestres (primitivas marcadas com `data-figma` na aplicação);
 *   B. telas — monta cada tela usando instâncias, sobrescrevendo textos e
 *      trocando variantes dos componentes aninhados.
 *
 * Roda no sandbox do Figma: sem DOM, sem `atob`, sem módulos.
 */

/* ══════════════════════════════ configuração ══════════════════════════════ */

const GAP_X = 80;
const GAP_Y = 140;

/**
 * Sufixos que identificam os nós criados por esta ferramenta.
 *
 * Não usamos `setPluginData`: a API de plugin data exige um `id` no manifest, e
 * um plugin de desenvolvimento local (importado do manifest.json) não tem um.
 * A marcação é feita pelo nome, e só varremos páginas que são inteiramente
 * nossas (`Nexus Export` e `Nexus · Componentes`).
 */
const SUFIXO_EDIT = " · EDIT";
const SUFIXO_REF = " · REF";

const PAGINA_BIBLIOTECA = "Nexus · Componentes";
const PAGINA_TELAS = "Nexus Export";

/** Somente primitivas viram componentes (decisão de escopo do projeto). */
const COMPONENTES = [
  "Button",
  "PageButton",
  "SearchBar",
  "TableHeader",
  "TableRow",
  "TablePagination",
  "Modal",
  "ConfirmDialog",
  "Aviso",
  "Sidebar",
  "SidebarItem",
  "SidebarGroup",
  "SidebarSubItem",
  "DataTable",
  "FormularioUsuario",
  "FormularioFuncionario",
  "FormularioDestinatario",
  "FormularioFornecedor",
  "FormularioVeiculo",
  "FormularioProduto",
  "FormularioPerfil",
];

/**
 * Componentes que existem **apenas na biblioteca**: são padrões compostos, cujo
 * conteúdo varia por tela (o número de linhas de uma tabela, os campos
 * condicionais de um formulário, o conteúdo de um modal). As telas continuam
 * sendo reconstruídas 1:1 — e já usam as primitivas que compõem esses padrões.
 */
const SOMENTE_BIBLIOTECA = [
  "DataTable",
  "Modal",
  "FormularioUsuario",
  "FormularioFuncionario",
  "FormularioDestinatario",
  "FormularioFornecedor",
  "FormularioVeiculo",
  "FormularioProduto",
  "FormularioPerfil",
];

function ehSomenteBiblioteca(componente) {
  return SOMENTE_BIBLIOTECA.indexOf(componente) >= 0;
}

/*
 * Tokens de design: NÃO existe tabela aqui.
 *
 * Eles vêm do `src/app/globals.css` (fonte única) → colheita → manifesto
 * (`scenes.json` → `estado.tokens`). Copiá-los aqui já custou uma divergência:
 * o `globals.css` mudou e as variáveis do Figma continuaram antigas.
 */

const ALINHAMENTO = {
  left: "LEFT",
  start: "LEFT",
  right: "RIGHT",
  end: "RIGHT",
  center: "CENTER",
  justify: "JUSTIFIED",
};

/** Estilos por família no Figma (peso → nome do estilo). */
const ESTILOS = {
  Inter: [
    [100, "Thin"],
    [200, "Extra Light"],
    [300, "Light"],
    [400, "Regular"],
    [500, "Medium"],
    [600, "Semi Bold"],
    [700, "Bold"],
    [800, "Extra Bold"],
    [900, "Black"],
  ],
  Roboto: [
    [100, "Thin"],
    [300, "Light"],
    [400, "Regular"],
    [500, "Medium"],
    [700, "Bold"],
    [900, "Black"],
  ],
  "Roboto Mono": [
    [100, "Thin"],
    [200, "ExtraLight"],
    [300, "Light"],
    [400, "Regular"],
    [500, "Medium"],
    [600, "SemiBold"],
    [700, "Bold"],
  ],
};

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/* ══════════════════════════════ estado ══════════════════════════════ */

const estado = {
  cancelado: false,
  importando: false,
  estilos: [],
  origem: {},
  mestres: new Map(),
  icones: new Map(),
  primeiroIcone: null,
  emConstrucao: new Set(),
  variaveisCor: null,
  variaveisMetrica: null,
  variaveisProntas: false,
  /** Tokens do `globals.css` vindos do manifesto (`cores`/`metricas`). */
  tokens: null,
  paginaBiblioteca: null,
  secoes: new Map(),
  ordemSecoes: [],
  cursorSecao: new Map(),
  falhasDeComponente: new Map(),
  soltosRemovidos: 0,
  conferenciasEnviadas: 0,
  conferenciasFalhas: 0,
  proximoRotulo: 0,
  criados: 0,
  reusados: 0,
};

figma.showUI(__html__, { width: 420, height: 680, themeColors: true });

figma.ui.onmessage = function (msg) {
  if (msg.type === "cancelar") {
    estado.cancelado = true;
    avisar("Cancelamento solicitado…");
    return;
  }
  if (msg.type === "carregar") {
    carregarManifesto(msg.base).catch(function (erro) {
      enviar("manifesto", { ok: false, mensagem: textoDoErro(erro) });
    });
    return;
  }
  if (msg.type === "paginas") {
    listarPaginas().catch(function (erro) {
      enviar("paginas", { nomes: [], erro: textoDoErro(erro) });
    });
    return;
  }
  if (msg.type === "ler") {
    if (estado.importando) return;
    estado.importando = true;
    lerPagina(msg)
      .catch(function (erro) {
        enviar("leitura", { ok: false, mensagem: textoDoErro(erro) });
      })
      .finally(function () {
        estado.importando = false;
      });
    return;
  }
  if (msg.type === "importar") {
    if (estado.importando) return;
    importar(msg).catch(function (erro) {
      estado.importando = false;
      avisar("Falha: " + textoDoErro(erro));
      enviar("fim", { ok: false, mensagem: textoDoErro(erro) });
    });
  }
};

/**
 * Origem (esquema + host + porta) de uma URL, SEM usar o construtor `URL` —
 * o sandbox do Figma não expõe APIs de navegador (`URL`, `setTimeout`, DOM).
 */
function origemDoServidor(endereco) {
  const texto = String(endereco || "");
  const corte = texto.indexOf("://");
  if (corte < 0) return texto;
  const inicioDoHost = corte + 3;
  const barra = texto.indexOf("/", inicioDoHost);
  return texto.slice(0, barra < 0 ? texto.length : barra);
}

function textoDoErro(erro) {
  return erro && erro.message ? erro.message : String(erro);
}

function avisar(texto) {
  figma.notify(texto);
}

function enviar(tipo, dados) {
  figma.ui.postMessage(Object.assign({ tipo: tipo }, dados || {}));
}

/* ══════════════════════════════ variáveis ══════════════════════════════ */

function hexParaRgba(hex) {
  const limpo = hex.replace("#", "");
  const n = parseInt(limpo, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
    a: 1,
  };
}

/** `true` se a chave está na tabela (evita `in`, que acha o protótipo). */
function temChave(tabela, chave) {
  return Object.prototype.hasOwnProperty.call(tabela, chave);
}

/** Escopos específicos: evita poluir todos os seletores de propriedade. */
function aplicarEscopos(variavel, tipo) {
  try {
    variavel.scopes =
      tipo === "COLOR"
        ? ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR", "TEXT_FILL"]
        : ["WIDTH_HEIGHT", "GAP", "CORNER_RADIUS"];
  } catch {
    /* escopos são opcionais */
  }
}

/**
 * Coleção de variáveis por **upsert**, a partir dos tokens do manifesto:
 * a variável que já existe tem o valor do modo padrão **atualizado**; a que
 * não existe é **criada**. Nada é removido — um token que saiu da lista só é
 * registrado, porque pode estar em uso no design.
 *
 * Falha em uma variável não derruba a importação: vai para `registrarFalha`.
 */
async function garantirColecao(nome, colecaoExistente, tokens, tipo) {
  const colecao = colecaoExistente || figma.variables.createVariableCollection(nome);
  const modos = colecao.modes || [];
  const modoId = colecao.defaultModeId || (modos[0] ? modos[0].modeId : null);
  const mapa = {};

  if (colecaoExistente) {
    let locais = [];
    try {
      locais = await figma.variables.getLocalVariablesAsync(tipo);
    } catch (erro) {
      registrarFalha({ componente: nome }, "listar as variáveis existentes", erro);
    }
    for (let i = 0; i < locais.length; i++) {
      const variavel = locais[i];
      if (variavel.variableCollectionId !== colecao.id) continue;
      mapa[variavel.name] = variavel;
    }
  }

  if (!modoId) {
    registrarFalha({ componente: nome }, "descobrir o modo padrão da coleção", null);
    return mapa;
  }

  const chaves = Object.keys(tokens);
  let atualizadas = 0;
  let criadas = 0;
  for (let i = 0; i < chaves.length; i++) {
    const chave = chaves[i];
    const valor = tipo === "COLOR" ? hexParaRgba(tokens[chave]) : tokens[chave];
    try {
      if (mapa[chave]) {
        mapa[chave].setValueForMode(modoId, valor);
        atualizadas++;
      } else {
        const variavel = figma.variables.createVariable(chave, colecao, tipo);
        aplicarEscopos(variavel, tipo);
        variavel.setValueForMode(modoId, valor);
        mapa[chave] = variavel;
        criadas++;
      }
    } catch (erro) {
      registrarFalha({ componente: nome }, "gravar o token " + chave, erro);
    }
  }
  enviar("log", {
    texto: "  ✓ " + nome + ": " + criadas + " criada(s), " + atualizadas + " atualizada(s)",
  });

  const foraDosTokens = [];
  for (const chave in mapa) {
    if (!temChave(tokens, chave)) foraDosTokens.push(chave);
  }
  if (foraDosTokens.length) {
    enviar("log", {
      texto:
        "  ⚠ " +
        nome +
        ": " +
        foraDosTokens.length +
        " variável(is) fora dos tokens do globals.css (mantidas): " +
        foraDosTokens.join(", "),
      aviso: true,
    });
  }

  return mapa;
}

async function garantirVariaveis(pagina) {
  if (estado.variaveisProntas) return;

  const tokens = estado.tokens;
  if (!tokens || !tokens.cores || !tokens.metricas) {
    // Manifesto antigo (de antes dos tokens no `scenes.json`): as telas ainda
    // importam, mas sem variáveis — a falha fica visível em vez de silenciosa.
    registrarFalha(
      { componente: "Nexus / Variáveis" },
      "ler os tokens do manifesto",
      "o manifesto não traz `tokens` — rode `npm run figma:harvest`",
    );
    estado.variaveisCor = {};
    estado.variaveisMetrica = {};
    estado.variaveisProntas = true;
    void pagina;
    return;
  }

  let existentes = [];
  try {
    existentes = await figma.variables.getLocalVariableCollectionsAsync();
  } catch {
    existentes = [];
  }
  const nomes = {};
  for (const colecao of existentes) nomes[colecao.name] = colecao;

  // Reaproveita as coleções de uma execução anterior e converge cada variável
  // para o valor atual do `globals.css`.
  estado.variaveisCor = await garantirColecao(
    "Nexus / Cor",
    nomes["Nexus / Cor"],
    tokens.cores,
    "COLOR",
  );
  estado.variaveisMetrica = await garantirColecao(
    "Nexus / Métrica",
    nomes["Nexus / Métrica"],
    tokens.metricas,
    "FLOAT",
  );
  estado.variaveisProntas = true;
  void pagina;
}

/** Encontra a variável de cor cujo valor bate exatamente com o do preenchimento. */
function variavelDeCor(cor) {
  if (!estado.variaveisCor || !estado.tokens || !estado.tokens.cores) return null;
  const cores = estado.tokens.cores;
  for (const chave in estado.variaveisCor) {
    if (!temChave(cores, chave)) continue;
    const alvo = hexParaRgba(cores[chave]);
    if (
      Math.abs(alvo.r - cor.r) < 0.004 &&
      Math.abs(alvo.g - cor.g) < 0.004 &&
      Math.abs(alvo.b - cor.b) < 0.004
    ) {
      return estado.variaveisCor[chave];
    }
  }
  return null;
}

function variavelDeRaio(valor) {
  if (!estado.variaveisMetrica || !estado.tokens || !estado.tokens.metricas) return null;
  const metricas = estado.tokens.metricas;
  for (const chave in estado.variaveisMetrica) {
    if (chave.indexOf("raio-") !== 0 || !temChave(metricas, chave)) continue;
    if (Math.abs(metricas[chave] - valor) < 0.01) return estado.variaveisMetrica[chave];
  }
  return null;
}

/** Liga preenchimentos/contornos/raios às variáveis quando o valor coincide. */
function vincularVariaveis(raiz) {
  function visitar(no) {
    try {
      if ("fills" in no && Array.isArray(no.fills) && no.fills.length) {
        let mudou = false;
        const novos = no.fills.map(function (paint) {
          if (paint.type !== "SOLID" || paint.opacity !== undefined) return paint;
          const variavel = variavelDeCor(paint.color);
          if (!variavel) return paint;
          mudou = true;
          return figma.variables.setBoundVariableForPaint(paint, "color", variavel);
        });
        if (mudou) no.fills = novos;
      }
      if ("strokes" in no && Array.isArray(no.strokes) && no.strokes.length) {
        let mudou = false;
        const novos = no.strokes.map(function (paint) {
          if (paint.type !== "SOLID" || paint.opacity !== undefined) return paint;
          const variavel = variavelDeCor(paint.color);
          if (!variavel) return paint;
          mudou = true;
          return figma.variables.setBoundVariableForPaint(paint, "color", variavel);
        });
        if (mudou) no.strokes = novos;
      }
      if ("topLeftRadius" in no && no.topLeftRadius > 0) {
        const variavel = variavelDeRaio(no.topLeftRadius);
        if (variavel) {
          no.setBoundVariable("topLeftRadius", variavel);
          if (no.topRightRadius === no.topLeftRadius) no.setBoundVariable("topRightRadius", variavel);
          if (no.bottomLeftRadius === no.topLeftRadius) no.setBoundVariable("bottomLeftRadius", variavel);
          if (no.bottomRightRadius === no.topLeftRadius) no.setBoundVariable("bottomRightRadius", variavel);
        }
      }
    } catch {
      /* vinculação é opcional: nunca interrompe a importação */
    }
    // Não desce em instâncias: ligar variáveis lá dentro viraria override.
    if (no.type === "INSTANCE") return;
    if ("children" in no) {
      const filhos = no.children;
      for (let i = 0; i < filhos.length; i++) visitar(filhos[i]);
    }
  }
  visitar(raiz);
}

/* ══════════════════════════════ fontes ══════════════════════════════ */

const cacheFontes = new Map();

function mapearFamilia(nome) {
  const n = String(nome || "").toLowerCase();
  if (n.indexOf("roboto mono") >= 0) return "Roboto Mono";
  if (n.indexOf("roboto") >= 0) return "Roboto";
  if (n.indexOf("inter") >= 0) return "Inter";
  // "SF Pro" / "Segoe UI" / system-ui não existem no Figma → Inter
  return "Inter";
}

function estiloPara(familia, peso, italico) {
  const tabela = ESTILOS[familia] || ESTILOS.Inter;
  let escolhido = tabela[0];
  let menor = Infinity;
  for (let i = 0; i < tabela.length; i++) {
    const distancia = Math.abs(tabela[i][0] - peso);
    if (distancia < menor) {
      menor = distancia;
      escolhido = tabela[i];
    }
  }
  let nome = escolhido[1];
  if (italico) nome = nome === "Regular" ? "Italic" : nome + " Italic";
  return nome;
}

async function carregarFonte(familiaBruta, peso, italico) {
  const familia = mapearFamilia(familiaBruta);
  const estilo = estiloPara(familia, peso, italico);
  const chave = familia + "|" + estilo;
  if (cacheFontes.has(chave)) return cacheFontes.get(chave);

  let fonte = { family: familia, style: estilo };
  try {
    await figma.loadFontAsync(fonte);
  } catch {
    fonte = fonte.family === "Inter" && fonte.style === "Regular"
      ? { family: "Roboto", style: "Regular" }
      : { family: "Inter", style: "Regular" };
    try {
      await figma.loadFontAsync(fonte);
    } catch {
      fonte = { family: "Inter", style: "Regular" };
    }
  }
  cacheFontes.set(chave, fonte);
  return fonte;
}

/* ══════════════════════════════ pintura ══════════════════════════════ */

function tinta(cor) {
  const paint = { type: "SOLID", color: { r: cor.r, g: cor.g, b: cor.b } };
  if (typeof cor.a === "number" && cor.a < 1) paint.opacity = cor.a;
  return paint;
}

function efeitosDe(shadows) {
  const saida = [];
  for (let i = 0; i < (shadows || []).length; i++) {
    const s = shadows[i];
    saida.push({
      type: s.inset ? "INNER_SHADOW" : "DROP_SHADOW",
      color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
      offset: { x: s.x, y: s.y },
      radius: Math.max(0, s.blur || 0),
      spread: s.spread || 0,
      visible: true,
      blendMode: "NORMAL",
    });
  }
  return saida;
}

function raioDeBlur(valor) {
  const achado = String(valor || "").match(/blur\(\s*([\d.]+)px/);
  return achado ? parseFloat(achado[1]) : 8;
}

function estilizar(no, st) {
  no.fills = st.bg ? [tinta(st.bg)] : [];

  if (st.border) {
    no.strokes = [tinta(st.border.color)];
    const pesos = st.border.weights || [st.border.w, st.border.w, st.border.w, st.border.w];
    no.strokeWeight = Math.max(pesos[0], pesos[1], pesos[2], pesos[3]);
    no.strokeAlign = "INSIDE";
    // Pesos por lado: preserva bordas que existem em apenas um lado (abas,
    // separadores, borda superior do modal) em vez de desenhar a caixa inteira.
    try {
      no.strokeTopWeight = pesos[0];
      no.strokeRightWeight = pesos[1];
      no.strokeBottomWeight = pesos[2];
      no.strokeLeftWeight = pesos[3];
    } catch {
      /* alguns tipos de nó não aceitam pesos individuais */
    }
    if (st.border.style === "dashed") no.dashPattern = [4, 4];
    else if (st.border.style === "dotted") no.dashPattern = [1, 2];
  } else {
    no.strokes = [];
  }

  const r = st.radius || [0, 0, 0, 0];
  no.topLeftRadius = r[0];
  no.topRightRadius = r[1];
  no.bottomRightRadius = r[2];
  no.bottomLeftRadius = r[3];

  const lista = efeitosDe(st.shadows);
  if (st.blur) lista.push({ type: "BACKGROUND_BLUR", radius: raioDeBlur(st.blur), visible: true });
  if (st.filter) lista.push({ type: "LAYER_BLUR", radius: raioDeBlur(st.filter), visible: true });
  no.effects = lista;

  if (typeof st.opacity === "number" && st.opacity < 1) no.opacity = st.opacity;
}

function quadroVazio(w, h) {
  const quadro = figma.createFrame();
  quadro.fills = [];
  quadro.strokes = [];
  quadro.resize(Math.max(1, w), Math.max(1, h));
  return quadro;
}

/* ══════════════════════════════ imagens ══════════════════════════════ */

function decodificarBase64(texto) {
  const limpo = String(texto).replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes = [];
  let acumulado = 0;
  let bits = 0;
  for (let i = 0; i < limpo.length; i++) {
    const caractere = limpo.charAt(i);
    if (caractere === "=") break;
    const valor = BASE64.indexOf(caractere);
    if (valor < 0) continue;
    acumulado = (acumulado << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulado >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function bytesDeDataUrl(dataUrl) {
  const corte = String(dataUrl).indexOf(",");
  if (corte < 0) throw new Error("data URL inválida");
  const meta = dataUrl.slice(0, corte);
  const corpo = dataUrl.slice(corte + 1);
  if (/;base64/i.test(meta)) return decodificarBase64(corpo);
  const texto = decodeURIComponent(corpo);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff;
  return bytes;
}

/* ══════════════════════════════ texto ══════════════════════════════ */

async function aplicarTexto(no, texto, tamanho) {
  const ts = texto.style;
  const fonte = await carregarFonte(ts.fontFamily, ts.fontWeight, ts.fontStyle === "italic");

  if (no.fontName.family !== fonte.family || no.fontName.style !== fonte.style) {
    no.fontName = fonte;
  }
  if (no.characters !== texto.value) no.characters = texto.value;

  no.fontSize = ts.fontSize || 14;
  if (ts.lineHeight && ts.lineHeight.unit === "PIXELS" && ts.lineHeight.value > 0) {
    no.lineHeight = { unit: "PIXELS", value: ts.lineHeight.value };
  } else if (ts.lineHeight && ts.lineHeight.unit === "PERCENT") {
    no.lineHeight = { unit: "PERCENT", value: ts.lineHeight.value };
  } else {
    no.lineHeight = { unit: "AUTO" };
  }
  no.letterSpacing = ts.letterSpacing ? { unit: "PIXELS", value: ts.letterSpacing } : { unit: "PERCENT", value: 0 };
  no.textCase = ts.textCase && ts.textCase !== "ORIGINAL" ? ts.textCase : "ORIGINAL";
  no.textDecoration =
    ts.decoration === "underline" ? "UNDERLINE" : ts.decoration === "line-through" ? "STRIKETHROUGH" : "NONE";
  no.fills = [tinta(ts.color)];
  no.textAlignHorizontal = ALINHAMENTO[ts.align] || "LEFT";

  if (tamanho) {
    no.textAutoResize = "NONE";
    no.resize(Math.max(1, tamanho.w), Math.max(1, tamanho.h));
    if (texto.truncated) {
      no.textTruncation = "ENDING";
      no.maxLines = 1;
    } else if (texto.verticalCenter) {
      // Campos de formulário: o texto é centrado verticalmente na caixa. Este
      // ramo PRECISA vir antes do `singleLine` — senão o ajuste automático de
      // largura assumiria e o texto ficaria alinhado ao topo, ~7px acima.
      no.textAlignVertical = "CENTER";
    } else if (texto.singleLine) {
      no.textAutoResize = "WIDTH_AND_HEIGHT";
    } else {
      no.textAutoResize = "HEIGHT";
    }
  }
}

async function construirTexto(spec) {
  const no = figma.createText();
  await aplicarTexto(no, spec.text, { w: spec.w, h: spec.h });
  no.name = spec.name || "Texto";
  return no;
}

/* ══════════════════════════════ svg / imagem ══════════════════════════════ */

function svgComTamanho(markup, w, h) {
  const abertura = markup.match(/<svg[^>]*>/i);
  if (!abertura) return markup;
  let tag = abertura[0];
  tag = /\bwidth\s*=/i.test(tag)
    ? tag.replace(/\bwidth\s*=\s*"[^"]*"/i, 'width="' + w + '"')
    : tag.replace(/<svg/i, '<svg width="' + w + '"');
  tag = /\bheight\s*=/i.test(tag)
    ? tag.replace(/\bheight\s*=\s*"[^"]*"/i, 'height="' + h + '"')
    : tag.replace(/<svg/i, '<svg height="' + h + '"');
  return markup.replace(abertura[0], tag);
}

function construirSvg(spec) {
  let no = null;
  try {
    no = figma.createNodeFromSvg(svgComTamanho(spec.svg, spec.w, spec.h));
  } catch {
    no = null;
  }
  if (!no) return quadroVazio(spec.w, spec.h);
  no.name = spec.name || "svg";
  try {
    no.resize(Math.max(1, spec.w), Math.max(1, spec.h));
  } catch {
    /* o tamanho já veio no markup do SVG */
  }
  return no;
}

function construirImagem(spec) {
  const quadro = quadroVazio(spec.w, spec.h);
  quadro.clipsContent = true;
  quadro.name = spec.name || "imagem";
  try {
    const imagem = figma.createImage(bytesDeDataUrl(spec.imgData));
    quadro.fills = [
     {        type: "IMAGE",
        imageHash: imagem.hash,
        scaleMode: spec.objectFit === "contain" ? "FIT" : "FILL",
      },
    ];
  } catch {
    /* imagem ilegível: mantém o retângulo para preservar o layout */
  }
  return quadro;
}

/* ══════════════════════════════ auto-layout ══════════════════════════════ */

/**
 * Aplica auto-layout a um quadro.
 *
 * Detalhe crítico do Figma: definir `layoutMode` faz o quadro abraçar o conteúdo
 * quando o eixo principal está em AUTO (e um quadro novo NASCE em AUTO). Por isso
 * fixamos as dimensões antes e restauramos o tamanho medido depois.
 *
 * Quando `layout.hug` é verdadeiro o componente tem tamanho intrínseco (ex.:
 * `Button`, `inline-flex`): o eixo principal deve mesmo abraçar o conteúdo, para
 * reagir a mudanças de rótulo e de ícones.
 */
function aplicarLayoutBase(quadro, layout, larguraMedida, alturaMedida) {
  if (!layout) return;
  const hug = !!layout.hug;

  quadro.primaryAxisSizingMode = hug ? "AUTO" : "FIXED";
  quadro.counterAxisSizingMode = "FIXED";
  quadro.layoutMode = layout.mode;
  quadro.primaryAxisSizingMode = hug ? "AUTO" : "FIXED";
  quadro.counterAxisSizingMode = "FIXED";
  quadro.itemSpacing = layout.gap || 0;

  const p = layout.padding || [0, 0, 0, 0];
  quadro.paddingTop = p[0];
  quadro.paddingRight = p[1];
  quadro.paddingBottom = p[2];
  quadro.paddingLeft = p[3];

  quadro.primaryAxisAlignItems = layout.primaryAlign || "MIN";
  const cruzado = layout.counterAlign || "MIN";
  quadro.counterAxisAlignItems =
    layout.mode === "VERTICAL" && cruzado === "BASELINE" ? "MIN" : cruzado;

  if (hug) {
    // O tamanho no eixo cruzado já foi fixado antes de ligar o auto-layout;
    // redimensionar aqui tornaria o eixo principal FIXO e mataria o "abraçar".
    return;
  }

  try {
    quadro.resize(Math.max(1, larguraMedida), Math.max(1, alturaMedida));
  } catch {
    /* sem resize, permanece o tamanho anterior */
  }
}

function aplicarLayout(quadro, spec) {
  const layout = spec.layout;
  if (!layout) return;

  aplicarLayoutBase(quadro, layout, spec.w, spec.h);

  const filhos = quadro.children;
  const filhosSpec = spec.children || [];
  for (let i = 0; i < filhos.length && i < filhosSpec.length; i++) {
    const no = filhos[i];
    const filhoSpec = filhosSpec[i];
    try {
      if (filhoSpec.grow) no.layoutGrow = 1;
      if (filhoSpec.stretch) no.layoutAlign = "STRETCH";
    } catch {
      /* alguns nós não aceitam grow/align */
    }
  }

  if (layout.hug) return;

  // o layout pode ter reencolhido o quadro: o tamanho medido tem a palavra final
  const larguraMedida = Math.max(1, spec.w);
  const alturaMedida = Math.max(1, spec.h);
  try {
    if (quadro.width !== larguraMedida || quadro.height !== alturaMedida) {
      quadro.resize(larguraMedida, alturaMedida);
    }
  } catch {
    /* ignora */
  }
}

/* ══════════════════════════════ componentes ══════════════════════════════ */

/**
 * Dimensões de variante. Cada dimensão vira um eixo de variação do componente
 * (ex.: `Variante=primary`, `Estado=padrao`).
 */
const DIMENSOES_VARIANTE = ["variant", "state", "columns"];

/** Rótulo legível de uma dimensão para o nome do mestre. */
function rotuloDaDimensao(dimensao, valor) {
  if (dimensao === "columns") return valor + " colunas";
  return valor;
}

function dimensoesDe(spec) {
  const props = spec.componentProps || {};
  const partes = [];
  for (let i = 0; i < DIMENSOES_VARIANTE.length; i++) {
    const dimensao = DIMENSOES_VARIANTE[i];
    if (props[dimensao]) partes.push(dimensao + "=" + props[dimensao]);
  }
  return partes;
}

/**
 * Componentes repetidos cujo conteúdo varia por tela (tabelas) ganham uma
 * dimensão extra na chave: a assinatura estrutural. Duas tabelas com a mesma
 * contagem de colunas mas células de forma diferente não podem compartilhar o
 * mesmo mestre.
 */
const USA_ASSINATURA = ["TableRow", "TableHeader"];

function assinaturaEstrutural(spec) {
  let texto = "";
  const visitar = (no, nivel) => {
    texto +=
      nivel +
      ":" +
      (no.kind || "?") +
      ":" +
      (no.componente || "") +
      ":" +
      (no.children ? no.children.length : 0) +
      "|";
    const filhos = no.children || [];
    for (let i = 0; i < filhos.length; i++) visitar(filhos[i], nivel + 1);
  };
  visitar(spec, 0);
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

/**
 * Componentes cujos filhos ficam POSICIONADOS (sem auto-layout) não reagem a
 * redimensionamento: um mestre de 1070 usado numa tabela de 664 deixaria a
 * paginação deslocada e cortada. Nesses casos a largura entra na chave, então
 * cada largura tem o seu mestre.
 */
function larguraComoDimensao(spec) {
  return !spec.layout && spec.w > 0;
}

function chaveDe(spec) {
  let base = spec.componente + "|" + dimensoesDe(spec).join("&");
  if (USA_ASSINATURA.indexOf(spec.componente) >= 0) {
    base += "&forma=" + assinaturaEstrutural(spec);
  }
  if (larguraComoDimensao(spec)) {
    base += "&largura=" + Math.round(spec.w);
  }
  return base;
}

/** Nome legível do mestre: `Button · primary · padrao`, `TableRow · normal · 5 colunas`. */
function nomeDoMestre(spec) {
  const valores = dimensoesDe(spec).map(function (parte) {
    const corte = parte.indexOf("=");
    return rotuloDaDimensao(parte.slice(0, corte), parte.slice(corte + 1));
  });
  if (larguraComoDimensao(spec)) valores.push(Math.round(spec.w) + " de largura");
  return spec.componente + (valores.length ? " · " + valores.join(" · ") : "");
}

function podeVirarComponente(spec) {
  return COMPONENTES.indexOf(spec.componente) >= 0;
}

/* ══════════════════════════════ organização da biblioteca ══════════════════════════════ */

/**
 * Pacotes (seções) da página de componentes. Cada grupo vira uma seção do
 * Figma, com os mestres organizados em grade dentro dela — bem mais fácil de
 * achar do que uma fileira única na página.
 */
const GRUPOS = [
  { nome: "Botões", prefixos: ["Button", "PageButton"] },
  { nome: "Formulários", prefixos: ["Formulario"] },
  { nome: "Sidebar", prefixos: ["Sidebar"] },
  { nome: "Tabelas", prefixos: ["DataTable", "TableHeader", "TableRow", "TablePagination"] },
  { nome: "Navegação e retorno", prefixos: ["SearchBar", "Modal", "ConfirmDialog", "Aviso"] },
  { nome: "Ícones", prefixos: [] },
];

const GRUPO_ICONES = "Ícones";
const GRUPO_PADRAO = "Outros";

function grupoDe(componente) {
  const nome = String(componente || "");
  if (nome.indexOf("Ícone ·") === 0) return GRUPO_ICONES;
  for (let i = 0; i < GRUPOS.length; i++) {
    const grupo = GRUPOS[i];
    for (let j = 0; j < grupo.prefixos.length; j++) {
      if (nome.indexOf(grupo.prefixos[j]) === 0) return grupo.nome;
    }
  }
  return GRUPO_PADRAO;
}

const PADDING_SECAO = 40;
const GAP_SECAO = 56;
const LARGURA_MAX_SECAO = 2600;

/** Cria (ou reaproveita) a seção de um grupo. */
function secaoDoGrupo(nome) {
  if (estado.secoes.has(nome)) return estado.secoes.get(nome);
  const secao = figma.createSection();
  secao.name = nome;
  estado.secoes.set(nome, secao);
  estado.ordemSecoes.push(nome);
  estado.cursorSecao.set(nome, { x: PADDING_SECAO, y: PADDING_SECAO, alturaLinha: 0 });
  return secao;
}

/** Coloca o mestre dentro da seção do seu grupo, em grade. */
function posicionarNaSecao(componente) {
  const grupo = grupoDe(componente.name);
  const secao = secaoDoGrupo(grupo);
  secao.appendChild(componente);

  const cursor = estado.cursorSecao.get(grupo);
  const alta = componente.height > 340;

  // Componente alto (Sidebar, Modal, formulários) ganha a própria linha: senão
  // ele estica a linha inteira e sobra um vazio enorme ao lado.
  if (cursor.x > PADDING_SECAO && (alta || cursor.x + componente.width > LARGURA_MAX_SECAO)) {
    cursor.x = PADDING_SECAO;
    cursor.y += cursor.alturaLinha + GAP_SECAO;
    cursor.alturaLinha = 0;
  }

  componente.x = cursor.x;
  componente.y = cursor.y;

  if (alta) {
    cursor.x = PADDING_SECAO;
    cursor.y += componente.height + GAP_SECAO;
    cursor.alturaLinha = 0;
    return;
  }

  cursor.x += componente.width + GAP_SECAO;
  cursor.alturaLinha = Math.max(cursor.alturaLinha, componente.height);
}

/**
 * Empilha as seções na página, abaixo do que já existia.
 *
 * O tamanho sai dos FILHOS (caixa real), não do cursor: o cursor só conhece a
 * última linha, então uma linha final estreita deixaria o pacote estreito e as
 * linhas de cima vazando para fora.
 */
function arrumarSecoes(baseY) {
  let y = baseY;
  for (let i = 0; i < estado.ordemSecoes.length; i++) {
    const nome = estado.ordemSecoes[i];
    const secao = estado.secoes.get(nome);
    if (!secao) continue;

    let larguraConteudo = 0;
    let alturaConteudo = 0;
    const filhos = secao.children;
    for (let j = 0; j < filhos.length; j++) {
      const filho = filhos[j];
      larguraConteudo = Math.max(larguraConteudo, filho.x + filho.width);
      alturaConteudo = Math.max(alturaConteudo, filho.y + filho.height);
    }

    const largura = Math.max(400, larguraConteudo + PADDING_SECAO);
    const altura = Math.max(200, alturaConteudo + PADDING_SECAO);
    try {
      secao.resize(largura, altura);
    } catch {
      /* se não aceitar, mantém o tamanho automático */
    }

    secao.x = 0;
    secao.y = y;
    y += altura + 140;
  }
  return y;
}

/** Fundo geral do quadro: um cinza claro, para os cards brancos se destacarem. */
function pintarFundoDaPagina(pagina) {
  try {
    pagina.backgrounds = [{ type: "SOLID", color: { r: 0.937, g: 0.949, b: 0.965 } }];
  } catch (erro) {
    enviar("log", {
      texto: "  ⚠ não foi possível pintar o fundo da página: " + textoDoErro(erro),
      aviso: true,
    });
  }
}

/** Cria (ou reaproveita) o componente mestre de uma ocorrência marcada. */
/* ══════════════════════════════ ícones ══════════════════════════════ */

/** Hash curto do markup, para dar nome a ícone inline sem marca explícita. */
function hashDoMarkup(markup) {
  const texto = String(markup || "");
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 5);
}

/** Cria (ou reaproveita) o componente de um ícone, para troca por INSTANCE_SWAP. */
async function garantirIcone(nome, markup) {
  if (!markup) return null;
  // Sem nome explícito, o nome sai do próprio markup: dois ícones diferentes
  // NUNCA podem virar o mesmo componente (já aconteceu de todos os botões de
  // paginação usarem a mesma seta).
  const chave = "Ícone · " + (nome || "svg-" + hashDoMarkup(markup));
  if (estado.icones.has(chave)) return estado.icones.get(chave);

  let nivel = null;
  try {
    nivel = figma.createNodeFromSvg(svgComTamanho(markup, 20, 20));
  } catch {
    return null;
  }

  let componente = null;
  try {
    componente = figma.createComponentFromNode(nivel);
  } catch {
    try {
      nivel.remove();
    } catch {
      /* já foi removido */
    }
    return null;
  }

  componente.name = chave;
  componente.description = descricaoDoIcone(componente.name.replace("Ícone · ", ""), !!nome);
  if (estado.paginaBiblioteca) {
    posicionarNaSecao(componente);
  }
  estado.icones.set(chave, componente);
  if (!estado.primeiroIcone) estado.primeiroIcone = componente;
  return componente;
}

/** Monta a biblioteca de ícones a partir de `public/icons`. */
async function carregarIcones(base) {
  let lista = [];
  try {
    const dados = await buscarJson(base + "/icons.json");
    lista = (dados && dados.icons) || [];
  } catch {
    enviar("log", { texto: "  ⚠ icons.json indisponível no servidor", aviso: true });
    return 0;
  }
  let criados = 0;
  for (let i = 0; i < lista.length; i++) {
    const antes = estado.icones.size;
    await garantirIcone(lista[i].nome, lista[i].svg);
    if (estado.icones.size > antes) criados++;
  }
  return criados;
}

/* ══════════════════════════════ busca na especificação ══════════════════════════════ */

function encontrarSvgNoSpec(spec) {
  let achado = null;
  const visitar = (no) => {
    if (achado) return;
    if (no.svg) {
      achado = { svg: no.svg, iconName: no.iconName || null };
      return;
    }
    const filhos = no.children || [];
    for (let i = 0; i < filhos.length; i++) visitar(filhos[i]);
  };
  visitar(spec);
  return achado;
}

function acharSlot(spec, nomeDoSlot) {
  let achado = null;
  const visitar = (no) => {
    if (achado) return;
    if (no.slot === nomeDoSlot) {
      achado = no;
      return;
    }
    const filhos = no.children || [];
    for (let i = 0; i < filhos.length; i++) visitar(filhos[i]);
  };
  visitar(spec);
  if (!achado) return null;
  const svg = encontrarSvgNoSpec(achado);
  if (!svg) return null;
  return { spec: achado, svg: svg.svg, iconName: achado.iconName || svg.iconName || null };
}

function acharPrimeiroTexto(spec) {
  if (spec.kind === "text") return spec.text;
  const filhos = spec.children || [];
  for (let i = 0; i < filhos.length; i++) {
    const achado = acharPrimeiroTexto(filhos[i]);
    if (achado) return achado;
  }
  return null;
}

/* ══════════════════════════════ Button ══════════════════════════════ */

/**
 * Monta o mestre do Button sempre com a mesma forma, independentemente da
 * ocorrência usada como referência: slot de ícone à esquerda, rótulo e slot de
 * ícone à direita. Assim o ícone deixa de ficar embutido no componente e passa a
 * ser uma propriedade (mostrar/ocultar + trocar por qualquer ícone da biblioteca).
 */
async function montarButton(spec, estilos) {
  const st = spec.style >= 0 ? estilos[spec.style] : null;
  const layout = spec.layout || {
    mode: "HORIZONTAL",
    gap: 6,
    padding: [0, 16, 0, 16],
    primaryAlign: "MIN",
    counterAlign: "CENTER",
    hug: true,
  };

  const quadro = figma.createFrame();
  quadro.name = nomeDoMestre(spec);
  quadro.clipsContent = !!spec.clip;
  if (st) estilizar(quadro, st);
  else quadro.fills = [];
  // Em layoutMode NONE o tamanho é simplesmente o medido no DOM.
  quadro.resize(Math.max(1, spec.w), Math.max(1, spec.h));

  const slotEsq = acharSlot(spec, "icon-left");
  const slotDir = acharSlot(spec, "icon-right");
  const rotulo = acharPrimeiroTexto(spec) || { value: "" };

  const iconeEsq = slotEsq ? await garantirIcone(slotEsq.iconName, slotEsq.svg) : null;
  const iconeDir = slotDir ? await garantirIcone(slotDir.iconName, slotDir.svg) : null;
  const padrao = iconeEsq || iconeDir || estado.primeiroIcone;

  let noEsq = null;
  let noRotulo = null;
  let noDir = null;

  if (padrao) {
    noEsq = (iconeEsq || padrao).createInstance();
    noEsq.name = "Ícone esquerdo";
    noEsq.visible = !!iconeEsq;
    quadro.appendChild(noEsq);
  }

  noRotulo = figma.createText();
  await aplicarTexto(noRotulo, rotulo, null);
  // Deixa explícito: o rótulo acompanha o texto (é o que permite o botão
  // "só ícone" encolher quando o rótulo fica vazio ou é ocultado).
  noRotulo.textAutoResize = "WIDTH_AND_HEIGHT";
  noRotulo.visible = !!rotulo.value;
  noRotulo.name = "Rótulo";
  quadro.appendChild(noRotulo);

  if (padrao) {
    noDir = (iconeDir || padrao).createInstance();
    noDir.name = "Ícone direito";
    noDir.visible = !!iconeDir;
    quadro.appendChild(noDir);
  }

  aplicarLayoutBase(quadro, layout, spec.w, spec.h);
  return {
    quadro: quadro,
    noEsq: noEsq,
    noRotulo: noRotulo,
    noDir: noDir,
    iconeEsq: iconeEsq || padrao,
    iconeDir: iconeDir || padrao,
  };
}

/** Transforma os slots do Button em propriedades de componente. */
function ligarPropriedadesButton(componente, montado) {
  const ids = { tipo: "button" };
  try {
    if (montado.noRotulo) {
      ids.rotulo = componente.addComponentProperty("Rótulo", "TEXT", montado.noRotulo.characters);
      ids.mostrarRotulo = componente.addComponentProperty(
        "Mostrar rótulo",
        "BOOLEAN",
        montado.noRotulo.visible,
      );
      montado.noRotulo.componentPropertyReferences = {
        characters: ids.rotulo,
        visible: ids.mostrarRotulo,
      };
    }
    if (montado.noEsq && montado.iconeEsq) {
      ids.mostrarEsq = componente.addComponentProperty(
        "Mostrar ícone à esquerda",
        "BOOLEAN",
        montado.noEsq.visible,
      );
      ids.iconeEsq = componente.addComponentProperty(
        "Ícone esquerdo",
        "INSTANCE_SWAP",
        montado.iconeEsq.id,
      );
      montado.noEsq.componentPropertyReferences = {
        visible: ids.mostrarEsq,
        mainComponent: ids.iconeEsq,
      };
    }
    if (montado.noDir && montado.iconeDir) {
      ids.mostrarDir = componente.addComponentProperty(
        "Mostrar ícone à direita",
        "BOOLEAN",
        montado.noDir.visible,
      );
      ids.iconeDir = componente.addComponentProperty(
        "Ícone direito",
        "INSTANCE_SWAP",
        montado.iconeDir.id,
      );
      montado.noDir.componentPropertyReferences = {
        visible: ids.mostrarDir,
        mainComponent: ids.iconeDir,
      };
    }
  } catch (erro) {
    enviar("log", {
      texto: "  ⚠ propriedades do Button não aplicadas: " + textoDoErro(erro),
      aviso: true,
    });
  }
  return ids;
}

/* ══════════════════════════════ componentes ══════════════════════════════ */

/**
 * Devolve uma cópia da especificação com apenas a primeira `TableRow`.
 * Um componente não consegue variar a quantidade de filhos, então o padrão de
 * tabela fica com uma linha: quem usa duplica a linha na instância.
 */
function especComUmaLinha(spec) {
  let linhasVistas = 0;

  const copiar = (no) => {
    const ehLinha = no.componente === "TableRow";
    if (ehLinha) {
      if (linhasVistas >= 1) return null;
      linhasVistas++;
    }
    const saida = Object.assign({}, no);
    if (no.layout) saida.layout = Object.assign({}, no.layout);
    if (no.children) {
      saida.children = [];
      for (let i = 0; i < no.children.length; i++) {
        const copia = copiar(no.children[i]);
        if (copia) saida.children.push(copia);
      }
    }
    return saida;
  };

  const resultado = copiar(spec);
  // sem as linhas extras a altura passa a vir do conteúdo
  if (resultado && resultado.layout) resultado.layout.hug = true;
  return resultado;
}

/** Registra uma falha de componente de forma visível — nunca silenciosa. */
function registrarFalha(spec, etapa, erro) {
  const dimensoes = dimensoesDe(spec);
  const nome =
    spec.componente + (dimensoes.length ? " (" + dimensoes.join(", ") + ")" : "");
  const mensagem = nome + " → " + etapa + ": " + textoDoErro(erro);
  const ocorrencias = estado.falhasDeComponente.get(mensagem) || 0;
  estado.falhasDeComponente.set(mensagem, ocorrencias + 1);
  // a mesma falha se repete por tela: mostra as primeiras e resume no fim
  if (ocorrencias < 3) {
    enviar("log", { texto: "  ✗ " + mensagem, erro: true });
  } else if (ocorrencias === 3) {
    enviar("log", { texto: "  ✗ " + mensagem + "  (e mais repetições iguais)", erro: true });
  }
}

/**
 * A página da biblioteca deve conter APENAS componentes. Um build que falha
 * deixa o frame solto na página, sobrepondo os demais — por isso é limpo.
 */
function limparSoltos(pagina) {
  const filhos = pagina.children.slice();
  let removidos = 0;
  for (let i = 0; i < filhos.length; i++) {
    const no = filhos[i];
    if (
      no.type === "COMPONENT" ||
      no.type === "COMPONENT_SET" ||
      no.type === "SECTION"
    ) {
      continue;
    }
    enviar("log", {
      texto: "  ⌫ solto na biblioteca: " + no.name + " (" + no.type + ") — removido",
      aviso: true,
    });
    no.remove();
    removidos++;
  }
  return removidos;
}

/** Y livre no fim do conteúdo da página. */
function fimDaPagina(pagina) {
  let fim = 0;
  const filhos = pagina.children;
  for (let i = 0; i < filhos.length; i++) {
    const no = filhos[i];
    if (typeof no.y === "number" && typeof no.height === "number") {
      fim = Math.max(fim, no.y + no.height);
    }
  }
  return fim;
}

/** Texto da descrição de um mestre — formato lido por `diff.ts`.
 *
 * A tabela de origens vem do manifesto (`carregarManifesto`), não do plugin:
 * marcar um componente novo no app não exige mexer aqui.
 */
function descricaoDoMestre(spec) {
  const arquivo = (estado.origem || {})[spec.componente];
  const dimensoes = dimensoesDe(spec).map(function (parte) {
    return parte.slice(parte.indexOf("=") + 1);
  });
  const variante = dimensoes.length ? " · " + dimensoes.join(" · ") : "";
  if (!arquivo) {
    return "Origem: (não mapeada) #" + spec.componente + variante + "\nGerado pela exportação do Nexus.";
  }
  return "Origem: " + arquivo + "#" + spec.componente + variante + "\nGerado pela exportação do Nexus.";
}

/** Descrição de um ícone. */
function descricaoDoIcone(nome, temArquivoPublico) {
  return temArquivoPublico
    ? "Origem: public/icons/*/" + nome + ".svg"
    : "Origem: ícone inline do app — nome informado por data-figma-icon=" + nome;
}

async function garantirMestre(spec, estilos) {
  const chave = chaveDe(spec);
  if (estado.mestres.has(chave)) {
    estado.reusados++;
    return estado.mestres.get(chave);
  }
  if (estado.emConstrucao.has(chave)) return null;
  if (!podeVirarComponente(spec)) return null;

  estado.emConstrucao.add(chave);
  try {
    let componente = null;
    let propriedades = null;

    if (spec.componente === "Button") {
      const montado = await montarButton(spec, estilos);
      if (montado) {
        try {
          componente = figma.createComponentFromNode(montado.quadro);
          propriedades = ligarPropriedadesButton(componente, montado);
        } catch {
          componente = null;
        }
      }
    }

    if (!componente) {
      const especDoMestre = spec.componente === "DataTable" ? especComUmaLinha(spec) : spec;
      let no = null;
      try {
        no = await construir(especDoMestre, estilos, { comoMestre: true });
      } catch (erro) {
        registrarFalha(spec, "construir", erro);
        estado.emConstrucao.delete(chave);
        return null;
      }
      if (!no || no.type !== "FRAME") {
        registrarFalha(spec, "construir devolveu " + (no ? no.type : "nada"), null);
        estado.emConstrucao.delete(chave);
        return null;
      }
      try {
        componente = figma.createComponentFromNode(no);
      } catch (erro) {
        // Sem registrar, isso passava silenciosamente e deixava o frame solto
        // na página, sobrepondo os componentes.
        registrarFalha(spec, "criar componente", erro);
        estado.emConstrucao.delete(chave);
        return null;
      }
      // A API devolve "the newly created component node": se for um nó NOVO, o
      // frame original fica solto na página e precisa sair.
      if (componente.id !== no.id) {
        try {
          no.remove();
        } catch {
          /* já não existe */
        }
      }
      // Propriedades de texto: cada texto do mestre vira uma propriedade editável.
      try {
        const textos = coletarTextos(componente, true);
        const lista = [];
        for (let i = 0; i < textos.length; i++) {
          const nome = i === 0 ? "Rótulo" : "Texto " + (i + 1);
          const idProp = componente.addComponentProperty(nome, "TEXT", textos[i].characters);
          textos[i].componentPropertyReferences = { characters: idProp };
          lista.push(idProp);
        }
        propriedades = { tipo: "generico", lista: lista };
      } catch {
        propriedades = { tipo: "generico", lista: [] };
      }
    }

    componente.name = nomeDoMestre(spec);
    componente.description = descricaoDoMestre(spec);

    estado.mestres.set(chave + "#props", propriedades);

    vincularVariaveis(componente);

    // Na biblioteca os padrões compostos (formulários, tabela, modal) ganham
    // fundo branco próprio: no app quem dá o fundo é o modal, mas aqui o card
    // precisa se destacar do fundo da página.
    if (
      SOMENTE_BIBLIOTECA.indexOf(spec.componente) >= 0 &&
      (!componente.fills || componente.fills.length === 0)
    ) {
      try {
        componente.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      } catch {
        /* fundo é cosmético */
      }
    }

    if (estado.paginaBiblioteca) {
      posicionarNaSecao(componente);
    }

    estado.mestres.set(chave, componente);
    estado.criados++;
    enviar("log", { texto: "  ◆ componente " + componente.name });
    estado.emConstrucao.delete(chave);
    return componente;
  } catch (erro) {
    estado.emConstrucao.delete(chave);
    enviar("log", {
      texto: "  ⚠ componente " + chave + " falhou: " + textoDoErro(erro),
      aviso: true,
    });
    return null;
  }
}

/**
 * Coleta os textos de um nó para criar propriedades de componente.
 *
 * `ehRaiz` distingue a raiz (que pode ser o próprio componente/instância) dos
 * descendentes: dentro de uma instância aninhada os textos pertencem às
 * propriedades daquele componente, e o Figma recusa criar propriedades para eles.
 */
function coletarTextos(no, ehRaiz) {
  const saida = [];
  if (no.type === "TEXT") {
    saida.push(no);
    return saida;
  }
  if (!ehRaiz && no.type === "INSTANCE") return saida;
  if ("children" in no) {
    const filhos = no.children;
    for (let i = 0; i < filhos.length; i++) {
      const internos = coletarTextos(filhos[i], false);
      for (let j = 0; j < internos.length; j++) saida.push(internos[j]);
    }
  }
  return saida;
}

/* ══════════════════════════════ build ══════════════════════════════ */

/**
 * Constrói um nó a partir da especificação.
 *
 * Quando a especificação traz uma marca `componente`, devolve uma **instância**
 * do mestre correspondente (criando o mestre se necessário) — exceto quando o
 * próprio nó é o mestre sendo montado.
 */
async function construir(spec, estilos, opcoes) {
  const ehMestre = opcoes && opcoes.comoMestre;

  if (spec.kind === "text") return await construirTexto(spec);
  if (spec.kind === "svg") return construirSvg(spec);
  if (spec.kind === "image") return construirImagem(spec);

  if (spec.componente && !ehMestre && !ehSomenteBiblioteca(spec.componente)) {
    const mestre = await garantirMestre(spec, estilos);
    if (mestre) {
      const instancia = mestre.createInstance();
      instancia.name = spec.name || spec.componente;
      // Componentes com hug têm tamanho próprio: redimensionar tornaria o eixo
      // principal FIXO e o botão deixaria de reagir ao rótulo e aos ícones.
      if (!(spec.layout && spec.layout.hug)) {
        try {
          instancia.resize(Math.max(1, spec.w), Math.max(1, spec.h));
        } catch {
          /* instância com hug não aceita resize; segue com o tamanho do mestre */
        }
      }
      await aplicarOverrides(instancia, spec);
      return instancia;
    }
  }

  const quadro = figma.createFrame();
  const st = spec.style >= 0 ? estilos[spec.style] : null;
  if (st) estilizar(quadro, st);
  else quadro.fills = [];

  quadro.name = spec.name || "frame";
  quadro.clipsContent = !!spec.clip;
  quadro.resize(Math.max(1, spec.w), Math.max(1, spec.h));

  const filhos = spec.children || [];
  for (let i = 0; i < filhos.length; i++) {
    const filhoSpec = filhos[i];

    // Uma falha em um filho não pode derrubar o componente inteiro nem deixar
    // o frame pela metade solto na página: registra e segue com os demais.
    let no = null;
    try {
      no = await construir(filhoSpec, estilos, null);
    } catch (erro) {
      registrarFalha(filhoSpec, "filho de " + (spec.componente || spec.name || spec.kind), erro);
      continue;
    }

    try {
      quadro.appendChild(no);
      no.x = filhoSpec.x;
      no.y = filhoSpec.y;
    } catch (erro) {
      registrarFalha(filhoSpec, "encaixar em " + (spec.componente || spec.name || spec.kind), erro);
      try {
        no.remove();
      } catch {
        /* já saiu */
      }
      continue;
    }

    // Guarda contra nós que escapam do pai: sem isso eles ficam soltos na
    // página, sobrepondo tudo em (0,0).
    if (no.parent !== quadro) {
      registrarFalha(filhoSpec, "não ficou dentro de " + (quadro.name || "quadro"), null);
    }
  }

  aplicarLayout(quadro, spec);
  return quadro;
}

/** Sobrescreve propriedades e troca variantes de instâncias aninhadas. */
async function aplicarOverrides(instancia, spec) {
  if (spec.kind === "text") return;

  const propriedades = estado.mestres.get(chaveDe(spec) + "#props") || null;

  if (propriedades && propriedades.tipo === "button") {
    await aplicarPropriedadesButton(instancia, spec, propriedades);
    return;
  }

  const lista = (propriedades && propriedades.lista) || [];
  const textos = coletarTextos(instancia, true);
  const valores = coletarValores(spec, true);

  const porPropriedade = {};
  for (let i = 0; i < textos.length && i < valores.length; i++) {
    if (lista[i]) porPropriedade[lista[i]] = valores[i].value;
  }
  if (Object.keys(porPropriedade).length) {
    try {
      instancia.setProperties(porPropriedade);
    } catch {
      /* se a propriedade não existir mais, cai no ajuste direto abaixo */
    }
  }
  for (let i = 0; i < textos.length && i < valores.length; i++) {
    if (lista[i]) continue;
    try {
      if (textos[i].characters !== valores[i].value) {
        await aplicarTexto(textos[i], valores[i], null);
      }
    } catch {
      /* texto sobrescrito é opcional */
    }
  }

  await aplicarAninhados(instancia, spec);
}

/**
 * Aplica as propriedades do Button: rótulo, mostrar/ocultar cada ícone e a
 * troca do ícone em si por qualquer componente da biblioteca de ícones.
 */
async function aplicarPropriedadesButton(instancia, spec, propriedades) {
  const valores = {};
  const props = spec.componentProps || {};

  if (propriedades.rotulo) valores[propriedades.rotulo] = String(props.label || "");
  if (propriedades.mostrarRotulo) valores[propriedades.mostrarRotulo] = !!props.label;

  const slotEsq = acharSlot(spec, "icon-left");
  const slotDir = acharSlot(spec, "icon-right");

  if (propriedades.mostrarEsq) valores[propriedades.mostrarEsq] = !!slotEsq;
  if (propriedades.mostrarDir) valores[propriedades.mostrarDir] = !!slotDir;

  if (propriedades.iconeEsq && slotEsq) {
    const componente = await garantirIcone(slotEsq.iconName, slotEsq.svg);
    if (componente) valores[propriedades.iconeEsq] = componente.id;
  }
  if (propriedades.iconeDir && slotDir) {
    const componente = await garantirIcone(slotDir.iconName, slotDir.svg);
    if (componente) valores[propriedades.iconeDir] = componente.id;
  }

  if (Object.keys(valores).length) {
    try {
      instancia.setProperties(valores);
    } catch (erro) {
      enviar("log", {
        texto: "  ⚠ Button " + (props.label || "") + ": " + textoDoErro(erro),
        aviso: true,
      });
    }
  }
}

function categoriaDaSpec(spec) {
  return spec.kind === "text" ? "text" : "caixa";
}

function categoriaDoNo(no) {
  return no.type === "TEXT" ? "text" : "caixa";
}

async function aplicarAninhados(instancia, spec, caminho) {
  if (!("children" in instancia)) return;
  const filhos = instancia.children;
  const filhosSpec = spec.children || [];
  const trilha = (caminho ? caminho + " > " : "") + (spec.componente || spec.name);

  // As contagens podem divergir: o Figma omite filhos invisíveis em
  // `instance.children`, e a ocorrência usada como referência do mestre pode ter
  // menos filhos que esta tela. Pareamos por categoria (texto com texto, caixa
  // com caixa) para não aplicar a sobrescrita no nó errado.
  //
  // Só vale comparar quando a especificação TEM filhos: SVG e imagem são
  // construídos a partir do markup (com vetores dentro) e a especificação não
  // descreve esses filhos.
  if (filhosSpec.length > 0 && filhos.length !== filhosSpec.length) {
    enviar("log", {
      texto:
        "  ⚠ " +
        trilha +
        ": " +
        filhos.length +
        " filhos na instância contra " +
        filhosSpec.length +
        " na especificação — pareando pelo tipo",
      aviso: true,
    });
  }

  let i = 0;
  let j = 0;
  while (i < filhos.length && j < filhosSpec.length) {
    const esperado = categoriaDaSpec(filhosSpec[j]);
    let k = i;
    while (k < filhos.length && categoriaDoNo(filhos[k]) !== esperado) k++;
    if (k >= filhos.length) {
      j++;
      continue;
    }

    const no = filhos[k];
    const filhoSpec = filhosSpec[j];
    i = k + 1;
    j++;

    if (filhoSpec.kind === "text") continue;

    if (filhoSpec.componente && no.type === "INSTANCE") {
      const alvo = estado.mestres.get(chaveDe(filhoSpec));
      if (alvo) {
        let atual = null;
        try {
          // Com `documentAccess: dynamic-page` ler `instance.mainComponent`
          // LANÇA — é obrigatório usar a versão assíncrona.
          atual = await no.getMainComponentAsync();
        } catch (erro) {
          registrarFalha(filhoSpec, "ler componente principal", erro);
        }
        if (atual && atual.id !== alvo.id) {
          try {
            no.swapComponent(alvo);
          } catch (erro) {
            registrarFalha(filhoSpec, "trocar variante", erro);
          }
        }
      }
      await aplicarOverrides(no, filhoSpec);
      continue;
    }

    adotarTamanhoDaOcorrencia(no, filhoSpec);

    if ("children" in no) await aplicarAninhados(no, filhoSpec, trilha);
  }
}

/**
 * Um filho de instância adota o tamanho da ocorrência DESTA tela.
 *
 * O mestre é construído a partir da ocorrência mais completa de todas as telas,
 * então a altura de um filho que o texto decide — a mensagem do `ConfirmDialog`,
 * por exemplo — vem da tela maior e sobra espaço dentro da instância: o
 * auto-layout do pai empurra a barra de botões para baixo e o diálogo fica com um
 * vão que a tela de referência não tem.
 *
 * Quem o próprio auto-layout dimensiona fica de fora: filho com `grow` (o Figma
 * calcula pela sobra do pai) e filho com `hug` (o tamanho é intrínseco ao
 * conteúdo). Aí o mestre é quem sabe.
 */
function adotarTamanhoDaOcorrencia(no, spec) {
  if (spec.kind !== "frame" || no.type !== "FRAME") return;
  if (spec.grow || (spec.layout && spec.layout.hug)) return;
  if (!(spec.w > 0) || !(spec.h > 0)) return;
  try {
    if (Math.abs(no.width - spec.w) > 0.5 || Math.abs(no.height - spec.h) > 0.5) {
      no.resize(spec.w, spec.h);
    }
  } catch {
    /* tamanho preso ao layout: o Figma recalcula */
  }
}

/**
 * Textos de uma especificação, na mesma ordem de `coletarTextos`.
 * Não desce em componentes aninhados (eles têm propriedades próprias).
 */
function coletarValores(spec, ehRaiz) {
  const saida = [];
  if (spec.kind === "text") {
    saida.push(spec.text);
    return saida;
  }
  if (!ehRaiz && spec.componente) return saida;
  const filhos = spec.children || [];
  for (let i = 0; i < filhos.length; i++) {
    const internos = coletarValores(filhos[i], false);
    for (let j = 0; j < internos.length; j++) saida.push(internos[j]);
  }
  return saida;
}

/** Coleta todas as ocorrências marcadas de uma cena (para a passada da biblioteca). */
function coletarComponentes(spec, saida) {
  if (spec.componente) saida.push(spec);
  const filhos = spec.children || [];
  for (let i = 0; i < filhos.length; i++) coletarComponentes(filhos[i], saida);
  return saida;
}

/* ══════════════════════════════ páginas ══════════════════════════════ */

async function obterPagina(nome, substituir, modo) {
  const paginas = figma.root.children;
  for (let i = 0; i < paginas.length; i++) {
    const pagina = paginas[i];
    await pagina.loadAsync();
    if (pagina.name === nome) {
      if (substituir) {
        const filhos = pagina.children.slice();
        for (let j = 0; j < filhos.length; j++) {
          const filho = filhos[j];
          const remover =
            modo === "biblioteca"
              ? filho.type === "COMPONENT" ||
                filho.type === "COMPONENT_SET" ||
                filho.type === "SECTION"
              : ehNosso(filho);
          if (remover) filho.remove();
        }
      }
      return pagina;
    }
  }
  const nova = figma.createPage();
  nova.name = nome;
  return nova;
}

/** Nós criados por esta ferramenta (identificados pelo sufixo do nome). */
function ehNosso(no) {
  return (
    typeof no.name === "string" &&
    (no.name.endsWith(SUFIXO_EDIT) || no.name.endsWith(SUFIXO_REF))
  );
}

/* ══════════════════════════════ rede ══════════════════════════════ */

async function buscarJson(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("HTTP " + resposta.status + " em " + url);
  return await resposta.json();
}

async function buscarBytes(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("HTTP " + resposta.status + " em " + url);
  return new Uint8Array(await resposta.arrayBuffer());
}

async function carregarManifesto(base) {
  const manifesto = await buscarJson(String(base).replace(/\/+$/, "") + "/scenes.json");
  // Duas tabelas vêm do manifesto, não do plugin: a de origens (o `figma:diff`
  // usa a mesma para dizer onde mexer) e a de tokens do `globals.css`.
  estado.origem = (manifesto && manifesto.origem) || {};
  estado.tokens = (manifesto && manifesto.tokens) || null;
  enviar("manifesto", { ok: true, manifesto: manifesto });
}

/* ══════════════════════════════ leitura do Figma (volta) ══════════════════════════════ */

/**
 * Lê o Figma de volta: os designers editam cópias na página deles e este
 * caminho serializa a página para o servidor local. Depois `npm run figma:diff`
 * compara com a última colheita e diz o que mudou e em qual arquivo do app.
 */

async function nomeDaVariavel(id) {
  if (!id) return null;
  try {
    const variavel = await figma.variables.getVariableByIdAsync(id);
    return variavel ? variavel.name : null;
  } catch {
    return null;
  }
}

function hexDaCor(cor) {
  if (!cor) return null;
  return (
    "#" +
    [cor.r, cor.g, cor.b]
      .map(function (v) {
        return Math.round(v * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

async function lerPintura(paint) {
  if (!paint) return null;
  if (paint.type === "SOLID") {
    return {
      tipo: "SOLID",
      cor: hexDaCor(paint.color),
      opacidade: paint.opacity === undefined ? 1 : paint.opacity,
      vinculo:
        paint.boundVariables && paint.boundVariables.color
          ? await nomeDaVariavel(paint.boundVariables.color.id)
          : null,
    };
  }
  return { tipo: String(paint.type) };
}

function lerEfeito(efeito) {
  return {
    tipo: efeito.type,
    cor: hexDaCor(efeito.color),
    x: efeito.offset ? Math.round(efeito.offset.x) : 0,
    y: efeito.offset ? Math.round(efeito.offset.y) : 0,
    raio: efeito.radius === undefined ? null : Math.round(efeito.radius),
    visivel: efeito.visible !== false,
  };
}

/** Lê um nó (async: getMainComponentAsync e as variáveis são assíncronos). */
async function lerNo(no) {
  const saida = {
    tipo: no.type,
    nome: no.name,
    x: Math.round(no.x),
    y: Math.round(no.y),
    w: Math.round(no.width),
    h: Math.round(no.height),
    visivel: no.visible !== false,
  };

  if (typeof no.description === "string" && no.description) {
    // a âncora que a exportação gravou (caminho do código)
    saida.descricao = no.description.split("\n")[0];
  }

  if (no.type === "TEXT" && typeof no.characters === "string") {
    saida.texto = no.characters;
    saida.fonte = {
      familia: no.fontName ? no.fontName.family : null,
      estilo: no.fontName ? no.fontName.style : null,
      tamanho: no.fontSize,
      lineHeight: no.lineHeight,
      letterSpacing: no.letterSpacing,
      alinhamento: no.textAlignHorizontal,
    };
  }

  if (no.layoutMode && no.layoutMode !== "NONE") {
    saida.layout = {
      modo: no.layoutMode,
      gap: no.itemSpacing,
      pad: [no.paddingTop, no.paddingRight, no.paddingBottom, no.paddingLeft],
      principal: no.primaryAxisAlignItems,
      cruzado: no.counterAxisAlignItems,
    };
  }

  try {
    if ("fills" in no && Array.isArray(no.fills) && no.fills.length) {
      saida.fills = [];
      for (let i = 0; i < no.fills.length; i++) saida.fills.push(await lerPintura(no.fills[i]));
    }
    if ("strokes" in no && Array.isArray(no.strokes) && no.strokes.length) {
      saida.strokes = [];
      for (let i = 0; i < no.strokes.length; i++) saida.strokes.push(await lerPintura(no.strokes[i]));
      saida.pesoContorno = no.strokeWeight;
    }
    if ("effects" in no && Array.isArray(no.effects) && no.effects.length) {
      saida.efeitos = no.effects.map(lerEfeito);
    }
  } catch {
    /* estilos são opcionais */
  }

  if (
    "topLeftRadius" in no &&
    (no.topLeftRadius || no.topRightRadius || no.bottomLeftRadius || no.bottomRightRadius)
  ) {
    saida.raio = [no.topLeftRadius, no.topRightRadius, no.bottomRightRadius, no.bottomLeftRadius];
  }

  // Lê propriedades de componente só da definição "dona" (numa variante dentro
  // de um conjunto o getter lança).
  const pai = no.parent;
  if (
    (no.type === "COMPONENT" || no.type === "COMPONENT_SET") &&
    !(pai && pai.type === "COMPONENT_SET")
  ) {
    try {
      const definicoes = no.componentPropertyDefinitions || {};
      saida.definicao = Object.keys(definicoes).map(function (chave) {
        return chave.split("#")[0];
      });
    } catch {
      /* sem definição acessível */
    }
  }

  if (no.type === "INSTANCE") {
    try {
      const mestre = await no.getMainComponentAsync();
      saida.componente = mestre ? mestre.name : null;
      saida.ancoraDoComponente = mestre && mestre.description ? mestre.description.split("\n")[0] : null;
    } catch {
      saida.componente = null;
    }
    try {
      const propriedades = no.componentProperties || {};
      saida.propriedades = {};
      for (const chave of Object.keys(propriedades)) {
        const info = propriedades[chave];
        saida.propriedades[chave.split("#")[0]] = info ? info.value : null;
      }
    } catch {
      saida.propriedades = {};
    }
  }

  const filhos = "children" in no ? no.children : [];
  if (filhos.length) {
    saida.filhos = [];
    for (let i = 0; i < filhos.length; i++) saida.filhos.push(await lerNo(filhos[i]));
  }
  return saida;
}

/** Todas as variáveis locais, com o valor do modo padrão. */
async function lerVariaveis() {
  const saida = [];
  try {
    const colecoes = await figma.variables.getLocalVariableCollectionsAsync();
    const colecaoPorId = {};
    const modoPadrao = {};
    for (const colecao of colecoes) {
      colecaoPorId[colecao.id] = colecao.name;
      modoPadrao[colecao.id] = colecao.modes[0] ? colecao.modes[0].modeId : null;
    }
    const variaveis = await figma.variables.getLocalVariablesAsync();
    for (const variavel of variaveis) {
      const modo = modoPadrao[variavel.variableCollectionId];
      const cru = modo ? variavel.valuesByMode[modo] : null;
      let valor = cru;
      if (cru && typeof cru === "object" && cru.r !== undefined) valor = hexDaCor(cru);
      saida.push({
        colecao: colecaoPorId[variavel.variableCollectionId] || null,
        nome: variavel.name,
        tipo: variavel.resolvedType,
        valor: valor === undefined ? null : valor,
      });
    }
  } catch (erro) {
    enviar("logLeitura", { texto: "  ⚠ não foi possível ler as variáveis: " + textoDoErro(erro), aviso: true });
  }
  return saida;
}

async function listarPaginas() {
  const nomes = [];
  const paginas = figma.root.children;
  for (let i = 0; i < paginas.length; i++) nomes.push(paginas[i].name);
  enviar("paginas", { nomes: nomes });
}

async function lerPagina(msg) {
  const nome = String(msg.pagina || "");
  const base = String(msg.base || "").replace(/\/+$/, "");
  estado.cancelado = false;

  const paginas = figma.root.children;
  let alvo = null;
  for (let i = 0; i < paginas.length; i++) {
    await paginas[i].loadAsync();
    if (paginas[i].name === nome) {
      alvo = paginas[i];
      break;
    }
  }
  if (!alvo) {
    enviar("leitura", { ok: false, mensagem: "Página não encontrada: " + nome });
    return;
  }

  await figma.setCurrentPageAsync(alvo);
  enviar("logLeitura", {
    texto: "Lendo \"" + nome + "\" — " + alvo.children.length + " nó(s) no topo…",
  });

  const raizes = [];
  for (let i = 0; i < alvo.children.length; i++) {
    if (estado.cancelado) break;
    raizes.push(await lerNo(alvo.children[i]));
    enviar("progressoLeitura", { feito: i + 1, total: alvo.children.length });
  }

  const variaveis = await lerVariaveis();
  const snapshot = {
    pagina: nome,
    lidoEm: new Date().toISOString(),
    variaveis: variaveis,
    raizes: raizes,
  };

  try {
    const resposta = await fetch(origemDoServidor(base) + "/snapshot/" + encodeURIComponent(nome), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    enviar("leitura", {
      ok: true,
      mensagem:
        nome + ": " + raizes.length + " nó(s) e " + variaveis.length + " variável(is) enviados",
    });
  } catch (erro) {
    enviar("leitura", { ok: false, mensagem: "envio falhou: " + textoDoErro(erro) });
  }
}

/* ══════════════════════════════ importação ══════════════════════════════ */

/** Nós de uma especificação (usado para escolher a ocorrência mais completa). */
function contarNos(spec) {
  let total = 1;
  const filhos = spec.children || [];
  for (let i = 0; i < filhos.length; i++) total += contarNos(filhos[i]);
  return total;
}

/**
 * Passada A: garante todos os mestres antes de montar qualquer tela.
 *
 * O mestre sai da ocorrência **mais completa** de cada componente, não da
 * primeira: telas sem usuário logado (primeiro acesso) têm a sidebar sem os
 * itens de cadastro, e usá-las como referência geraria um componente incompleto.
 */
async function construirBiblioteca(cenas, base) {
  let total = 0;
  const ocorrencias = new Map();

  for (let i = 0; i < cenas.length; i++) {
    if (estado.cancelado) return total;
    const cena = cenas[i];
    enviar("progresso", { feito: i, total: cenas.length, rotulo: "biblioteca · " + cena.title });
    try {
      const dados = await buscarJson(base + "/" + cena.file);
      const marcados = coletarComponentes(dados.root, []);
      for (let j = 0; j < marcados.length; j++) {
        const marcado = marcados[j];
        if (!podeVirarComponente(marcado)) continue;
        const chave = chaveDe(marcado);
        const peso = contarNos(marcado);
        const area = (marcado.w || 0) * (marcado.h || 0);
        const atual = ocorrencias.get(chave);
        // mais completa primeiro; empate desempata pela maior área
        if (!atual || peso > atual.peso || (peso === atual.peso && area > atual.area)) {
          ocorrencias.set(chave, { spec: marcado, estilos: dados.styles, peso: peso, area: area });
        }
      }
      total++;
    } catch (erro) {
      enviar("log", {
        texto: "  ✗ " + cena.id + " (biblioteca): " + textoDoErro(erro),
        erro: true,
      });
    }
  }

  // De baixo para cima: um componente sempre é maior que os componentes que
  // contém, então montar do menor para o maior garante que os filhos já existam
  // com a ocorrência Escolhida — e não criados "de carona" pelo pai.
  const ordenadas = [...ocorrencias.values()].sort((a, b) => a.peso - b.peso);
  for (let i = 0; i < ordenadas.length; i++) {
    if (estado.cancelado) break;
    await garantirMestre(ordenadas[i].spec, ordenadas[i].estilos);
  }

  return total;
}

async function montarCena(dados, cena, base, y, opcoes) {
  const largura = dados.viewport.width;
  const altura = dados.viewport.height;

  if (opcoes.modo !== "ref") {
    const raiz = await construir(dados.root, dados.styles, null);
    raiz.name = cena.id + SUFIXO_EDIT;
    raiz.x = 0;
    raiz.y = y;
    vincularVariaveis(raiz);

    if (opcoes.verificar) {
      try {
        const png = await raiz.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 },
        });
        const origem = origemDoServidor(base);
        // O nome enviado tem de ser o MESMO das capturas do navegador
        // (`usuarios__lista`), senão o `figma:compare` não encontra o par.
        const arquivoDaCena = String(cena.refImage || "")
          .replace(/^.*\//, "")
          .replace(/\.png$/i, "");
        await fetch(origem + "/verify/" + encodeURIComponent(arquivoDaCena || cena.id), {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: png,
        });
        estado.conferenciasEnviadas++;
      } catch {
        estado.conferenciasFalhas++;
        enviar("log", {
          texto: "  ✗ conferência 1:1 de " + cena.id + " não enviada: " + textoDoErro(erro),
          erro: true,
        });
      }
    }
  }

  if (opcoes.modo !== "edit") {
    const bytes = await buscarBytes(base + "/" + cena.refImage);
    const imagem = figma.createImage(bytes);
    const quadro = figma.createFrame();
    quadro.name = cena.id + SUFIXO_REF;
    quadro.resize(largura, altura);
    quadro.fills = [{ type: "IMAGE", imageHash: imagem.hash, scaleMode: "FILL" }];
    quadro.x = largura + GAP_X;
    quadro.y = y;
    quadro.locked = true;
  }
}

async function importar(msg) {
  estado.importando = true;
  estado.cancelado = false;
  estado.mestres = new Map();
  estado.icones = new Map();
  estado.primeiroIcone = null;
  estado.emConstrucao = new Set();
  estado.falhasDeComponente = new Map();
  estado.soltosRemovidos = 0;
  estado.conferenciasEnviadas = 0;
  estado.conferenciasFalhas = 0;
  estado.secoes = new Map();
  estado.ordemSecoes = [];
  estado.cursorSecao = new Map();
  estado.criados = 0;
  estado.reusados = 0;

  const base = String(msg.base || "").replace(/\/+$/, "");
  const opcoes = msg.opcoes || {};
  const cenas = msg.cenas || [];

  if (!cenas.length) {
    estado.importando = false;
    enviar("fim", { ok: false, mensagem: "Nenhuma tela selecionada." });
    return;
  }

  enviar("log", { texto: "Preparando páginas…" });
  estado.paginaBiblioteca = await obterPagina(PAGINA_BIBLIOTECA, !!opcoes.substituir, "biblioteca");
  await figma.setCurrentPageAsync(estado.paginaBiblioteca);
  await garantirVariaveis(estado.paginaBiblioteca);
  enviar("log", { texto: "  ✓ variáveis e coleções prontas" });

  // Fundo geral da página + posição inicial abaixo do que já existe (sem isso,
  // uma importação sem "substituir" empilha os pacotes novos sobre os antigos).
  pintarFundoDaPagina(estado.paginaBiblioteca);
  const inicioBiblioteca = fimDaPagina(estado.paginaBiblioteca);
  const baseDaBiblioteca = inicioBiblioteca > 0 ? inicioBiblioteca + 140 : 0;

  // ── passada A: biblioteca ──
  if (opcoes.modo !== "ref") {
    enviar("log", { texto: "Passada 1/2 · montando a biblioteca de componentes…" });
    const totalIcones = await carregarIcones(base);
    enviar("log", { texto: "  ✓ " + totalIcones + " ícone(s) na biblioteca" });

    await construirBiblioteca(cenas, base);
    enviar("log", {
      texto: "  ✓ " + estado.criados + " componente(s) criado(s), " + estado.reusados + " reutilização(ões)",
    });

    // Empilha os pacotes (seções) na página, em ordem de leitura.
    arrumarSecoes(baseDaBiblioteca);
    enviar("log", {
      texto:
        "  ✓ " +
        estado.ordemSecoes.length +
        " pacote(s): " +
        estado.ordemSecoes.join(", "),
    });

    // Um build que falha deixa o frame solto na página; a página da biblioteca
    // deve conter apenas componentes e seções.
    const removidos = limparSoltos(estado.paginaBiblioteca);
    estado.soltosRemovidos = removidos;
    if (removidos > 0) {
      enviar("log", { texto: "  ⌫ " + removidos + " nó(s) solto(s) removido(s) da biblioteca", aviso: true });
    }
  }

  // ── passada B: telas ──
  const paginaTelas = await obterPagina(opcoes.pagina || PAGINA_TELAS, !!opcoes.substituir, "telas");
  await figma.setCurrentPageAsync(paginaTelas);

  let cursorY = 0;
  const existentes = paginaTelas.children;
  for (let i = 0; i < existentes.length; i++) {
    const no = existentes[i];
    if (typeof no.y === "number" && typeof no.height === "number") {
      cursorY = Math.max(cursorY, no.y + no.height);
    }
  }
  if (cursorY > 0) cursorY += GAP_Y;

  enviar("log", { texto: "Passada 2/2 · montando as telas…" });

  let feitas = 0;
  let falhas = 0;
  for (let i = 0; i < cenas.length; i++) {
    if (estado.cancelado) break;
    const cena = cenas[i];
    enviar("progresso", { feito: i, total: cenas.length, rotulo: cena.title });
    try {
      const dados = await buscarJson(base + "/" + cena.file);
      await montarCena(dados, cena, base, cursorY, opcoes);
      cursorY += dados.viewport.height + GAP_Y;
      feitas++;
      enviar("log", { texto: "  ✓ " + cena.id });
    } catch {
      falhas++;
      enviar("log", { texto: "  ✗ " + cena.id + ": " + textoDoErro(erro), erro: true });
    }
    enviar("progresso", { feito: i + 1, total: cenas.length, rotulo: cena.title });
  }

  estado.importando = false;
  const problemasDeComponente = estado.falhasDeComponente.size;
  const mensagem =
    feitas +
    " de " +
    cenas.length +
    " telas · " +
    estado.criados +
    " componentes" +
    (estado.soltosRemovidos ? " · " + estado.soltosRemovidos + " solto(s) removido(s)" : "") +
    (falhas ? " · " + falhas + " tela(s) com falha" : "") +
    (problemasDeComponente ? " · " + problemasDeComponente + " problema(s) de componente" : "") +
    (opcoes.verificar
      ? " · conferência 1:1: " +
        estado.conferenciasEnviadas +
        " enviada(s)" +
        (estado.conferenciasFalhas ? " e " + estado.conferenciasFalhas + " com falha" : "")
      : "");
  avisar(mensagem);
  enviar("fim", {
    ok: falhas === 0 && problemasDeComponente === 0,
    mensagem: mensagem,
    falhasDeComponente: [...estado.falhasDeComponente.entries()].map(
      function (entrada) {
        return entrada[1] > 1 ? entrada[0] + "  (" + entrada[1] + "x)" : entrada[0];
      },
    ),
  });
}
