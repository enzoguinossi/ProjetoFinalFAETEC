/**
 * Caminhador de DOM → especificação de nós do Figma.
 *
 * Roda DENTRO da página (via `page.evaluate`). Por isso:
 *   - não importa nada (não há módulos no contexto da página);
 *   - não usa TypeScript;
 *   - precisa ser totalmente autocontido.
 *
 * Entrada:  { viewport: { width, height }, maxNodes?: number, hide?: string[] }
 * Saída:    { root, styles, warnings, stats }
 *
 * Coordenadas são absolutas em relação ao viewport; a conversão para
 * coordenadas relativas (do nó para o pai) acontece na serialização.
 */
// Esta função é serializada e injetada na página pelo harvester (`harvest.ts`),
// por isso não é referenciada diretamente em nenhum lugar do código.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function walkDom(opts) {
  "use strict";

  var VW = opts.viewport.width;
  var VH = opts.viewport.height;
  var MAX_NODES = opts.maxNodes || 9000;
  var warnings = [];
  var warned = {};

  function warn(key, message) {
    if (warned[key]) return;
    warned[key] = true;
    warnings.push(message);
  }

  /* ══════════════════════════════ cores ══════════════════════════════ */

  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");

  function rgba(r, g, b, a) {
    return { r: round(r / 255), g: round(g / 255), b: round(b / 255), a: round(a) };
  }

  /**
   * Normaliza qualquer cor CSS (hex, rgb, hsl, oklch, color()) para rgba 0..1
   * usando o canvas como resolvedor — devolve null para cores invisíveis.
   */
  function parseColor(input) {
    if (input === null || input === undefined) return null;
    var s = String(input).trim();
    if (!s || s === "none" || s === "transparent") return null;
    if (!self.CSS || !CSS.supports || !CSS.supports("color", s)) return null;

    ctx.fillStyle = "#010203"; // sentinela
    try {
      ctx.fillStyle = s;
    } catch {
      return null;
    }
    var out = ctx.fillStyle;
    if (typeof out !== "string") return null;
    if (out === "#010203" && s.replace(/\s/g, "").toLowerCase() !== "#010203") return null;

    if (out.charAt(0) === "#") {
      var hex = out.slice(1);
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      var n = parseInt(hex, 16);
      return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, 1);
    }

    var m = out.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length < 3) return null;
    var a = parts.length > 3 ? parts[3] : 1;
    if (!(a > 0.001)) return null;
    return rgba(parts[0], parts[1], parts[2], a);
  }

  /* ══════════════════════════════ números ══════════════════════════════ */

  function round(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1000) / 1000;
  }

  function px(v) {
    var n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  /* ══════════════════════════════ sombras ══════════════════════════════ */

  /** Divide por vírgulas que estão no nível zero (ignora as de dentro de parênteses). */
  function splitTopLevel(value) {
    var out = [];
    var depth = 0;
    var current = "";
    for (var i = 0; i < value.length; i++) {
      var ch = value[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        out.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) out.push(current);
    return out;
  }

  function parseShadows(value) {
    if (!value || value === "none") return [];
    var effects = [];
    var parts = splitTopLevel(value);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part || part === "none") continue;
      var inset = /\binset\b/.test(part);
      part = part.replace(/\binset\b/g, " ").trim();

      // extrai os tokens de cor e os remove para sobram apenas os comprimentos
      var color = null;
      var colorRe = /(rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)|#[0-9a-fA-F]{3,8})/g;
      var match;
      while ((match = colorRe.exec(part)) !== null) {
        var parsed = parseColor(match[1]);
        if (parsed) color = parsed;
      }
      var lengths = part.replace(colorRe, " ").trim().split(/\s+/).filter(Boolean).map(px);
      if (lengths.length < 2) continue;

      effects.push({
        inset: inset,
        x: lengths[0],
        y: lengths[1],
        blur: lengths[2] || 0,
        spread: lengths[3] || 0,
        color: color || { r: 0, g: 0, b: 0, a: 1 },
      });
    }
    return effects;
  }

  /** Duas cores são iguais? (ignora a transparência) */
  function mesmaCor(a, b) {
    return (
      Math.abs(a.r - b.r) < 0.01 && Math.abs(a.g - b.g) < 0.01 && Math.abs(a.b - b.b) < 0.01
    );
  }

  /* ══════════════════════════════ texto ══════════════════════════════ */

  function ownTextNodes(el) {
    var out = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) out.push(node);
    }
    return out;
  }

  function unionRects(rects) {    var x1 = Infinity;
    var y1 = Infinity;
    var x2 = -Infinity;
    var y2 = -Infinity;
    var lines = 0;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.width <= 0 && r.height <= 0) continue;
      lines++;
      x1 = Math.min(x1, r.left);
      y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right);
      y2 = Math.max(y2, r.bottom);
    }
    if (!Number.isFinite(x1)) return null;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, lines: lines };
  }

  /** Caixa de conteúdo (sem borda/moldura) de um elemento. */
  function contentBox(el, rect, cs) {
    var bl = px(cs.borderLeftWidth);
    var bt = px(cs.borderTopWidth);
    var br = px(cs.borderRightWidth);
    var bb = px(cs.borderBottomWidth);
    var pl = px(cs.paddingLeft);
    var pt = px(cs.paddingTop);
    var pr = px(cs.paddingRight);
    var pb = px(cs.paddingBottom);
    return {
      x: rect.left + bl + pl,
      y: rect.top + bt + pt,
      w: Math.max(0, rect.width - bl - br - pl - pr),
      h: Math.max(0, rect.height - bt - bb - pt - pb),
    };
  }

  function lineHeightOf(cs, fontSize) {
    var raw = cs.lineHeight;
    if (!raw || raw === "normal") return { unit: "AUTO" };
    var value = parseFloat(raw);
    if (!Number.isFinite(value)) return { unit: "AUTO" };
    if (String(raw).indexOf("px") >= 0) return { unit: "PIXELS", value: value };
    if (String(raw).indexOf("%") >= 0) return { unit: "PERCENT", value: value };
    // line-height numérico (multiplicador)
    return { unit: "PIXELS", value: value * fontSize };
  }

  function fontFamilyOf(cs) {
    return (cs.fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
  }

  function textStyle(cs) {
    var fontSize = px(cs.fontSize);
    return {
      fontFamily: fontFamilyOf(cs),
      fontStack: cs.fontFamily || "",
      fontSize: fontSize,
      fontWeight: Number(cs.fontWeight) || 400,
      fontStyle: cs.fontStyle === "italic" ? "italic" : "normal",
      lineHeight: lineHeightOf(cs, fontSize),
      letterSpacing: cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing),
      color: parseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 },
      align: cs.textAlign || "left",
      decoration:
        (cs.textDecorationLine || "").indexOf("underline") >= 0
          ? "underline"
          : (cs.textDecorationLine || "").indexOf("line-through") >= 0
            ? "line-through"
            : "none",
      textCase:
        cs.textTransform === "uppercase"
          ? "UPPER"
          : cs.textTransform === "lowercase"
            ? "LOWER"
            : cs.textTransform === "capitalize"
              ? "TITLE"
              : "ORIGINAL",
    };
  }

  /**
   * Descreve o texto "próprio" (nós de texto filhos diretos) de um elemento.
   * Devolve null quando o elemento não desenha texto próprio.
   */
  function ownTextSpec(el, cs, rect) {
    var tag = el.tagName;
    var nodes = ownTextNodes(el);
    var value = "";
    var box = null;
    var single = true;
    var centered = false;
    var truncated = false;
    var color = null;

    if (tag === "INPUT" || tag === "TEXTAREA") {
      var type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox" || type === "radio" || type === "file" || type === "range") return null;
      var filled = el.value && el.value.length > 0;
      value = filled ? el.value : el.getAttribute("placeholder") || "";
      if (!value) return null;
      if (!filled) {
        var phStyles = getComputedStyle(el, "::placeholder");
        color = parseColor(phStyles.color);
        var corDoCampo = parseColor(cs.color);
        // O navegador pinta o placeholder no cinza padrão sem expor isso pelo
        // ::placeholder — quando a cor volta IGUAL à do campo, o app não
        // estilizou e usamos o padrão (preto a 54%), senão o placeholder sairia
        // escuro como o texto digitado.
        if (color && corDoCampo && mesmaCor(color, corDoCampo)) {
          color = { r: 0, g: 0, b: 0, a: 0.54 };
        }
      }
      box = contentBox(el, rect, cs);
      single = true;
      centered = true;
      if (type === "password") value = "•".repeat(el.value.length || el.getAttribute("placeholder") === "••••••••" ? Math.max(el.value.length, 8) : 8);
    } else if (tag === "SELECT") {
      var option = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      value = option ? String(option.textContent || "").trim() : "";
      if (!value) return null;
      box = contentBox(el, rect, cs);
      centered = true;
    } else {
      if (nodes.length === 0) return null;
      value = nodes
        .map(function (n) {
          return n.nodeValue;
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!value) return null;

      var range = document.createRange();
      range.setStartBefore(nodes[0]);
      range.setEndAfter(nodes[nodes.length - 1]);
      var rects = [];
      var list = range.getClientRects();
      for (var i = 0; i < list.length; i++) rects.push(list[i]);
      var u = unionRects(rects);
      if (!u) return null;
      box = { x: u.x, y: u.y, w: u.w, h: u.h };
      single = u.lines <= 1;

      var nowrap = (cs.whiteSpace || "").indexOf("nowrap") >= 0 || cs.whiteSpace === "pre";
      var ellipsis = (cs.textOverflow || "").indexOf("ellipsis") >= 0;
      var cb = contentBox(el, rect, cs);
      if (ellipsis && nowrap) {
        truncated = true;
        // Largura = caixa de conteúdo: é exatamente onde o navegador corta e
        // desenha as reticências. Usar a largura total do texto faria o Figma
        // mostrar o texto inteiro (e vazar da célula) em vez de "abc…".
        box = { x: cb.x, y: u.y, w: cb.w, h: u.h };
        single = true;
      } else if (!single) {
        // multilinha: usa a largura de conteúdo para preservar as quebras
        box = { x: cb.x, y: u.y, w: cb.w, h: u.h };
      }
    }

    if (!box) return null;
    var style = textStyle(cs);
    if (color) style.color = color;

    return {
      kind: "text",
      name: value.length > 40 ? value.slice(0, 39) + "…" : value,
      box: box,
      text: {
        value: value,
        style: style,
        singleLine: single && !truncated,
        truncated: truncated,
        verticalCenter: centered,
      },
    };
  }

  /* ══════════════════════════════ estilos ══════════════════════════════ */

  function borderOf(cs, side) {
    var width = px(cs["border" + side + "Width"]);
    var style = cs["border" + side + "Style"];
    if (!(width > 0) || !style || style === "none" || style === "hidden") return null;
    var color = parseColor(cs["border" + side + "Color"]);
    if (!color) return null;
    return { w: width, color: color, style: style };
  }

  function styleOf(el, cs) {
    var bg = parseColor(cs.backgroundColor);
    var bgImage = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : null;
    if (bgImage) {
      warn(
        "bgimage",
        "Imagem/gradiente de fundo CSS não é suportado e foi ignorado (" + bgImage.slice(0, 60) + "…).",
      );
      bgImage = null;
    }

    var borders = {
      top: borderOf(cs, "Top"),
      right: borderOf(cs, "Right"),
      bottom: borderOf(cs, "Bottom"),
      left: borderOf(cs, "Left"),
    };

    var pesos = [
      borders.top ? borders.top.w : 0,
      borders.right ? borders.right.w : 0,
      borders.bottom ? borders.bottom.w : 0,
      borders.left ? borders.left.w : 0,
    ];
    var maiorPeso = Math.max(pesos[0], pesos[1], pesos[2], pesos[3]);

    var border = null;
    if (maiorPeso > 0) {
      var referencia = borders.top || borders.right || borders.bottom || borders.left;
      var lados = [borders.top, borders.right, borders.bottom, borders.left];
      var cores = [];
      for (var bi = 0; bi < lados.length; bi++) {
        if (!lados[bi]) continue;
        var chaveCor = JSON.stringify(lados[bi].color);
        if (cores.indexOf(chaveCor) < 0) cores.push(chaveCor);
      }
      if (cores.length > 1) {
        warn(
          "bordercolor",
          "Bordas com cores diferentes por lado (o Figma aceita uma cor por nó): foi usada a cor de um dos lados.",
        );
      }
      border = {
        color: referencia.color,
        style: referencia.style,
        w: maiorPeso,
        weights: pesos,
      };
    }

    return {
      bg: bg,
      bgImageUrl: bgImage,
      border: border,
      radius: [
        px(cs.borderTopLeftRadius),
        px(cs.borderTopRightRadius),
        px(cs.borderBottomRightRadius),
        px(cs.borderBottomLeftRadius),
      ],
      shadows: parseShadows(cs.boxShadow),
      opacity: round(Number(cs.opacity)),
      filter: cs.filter && cs.filter !== "none" ? cs.filter : null,
      blur: cs.backdropFilter && cs.backdropFilter !== "none" ? cs.backdropFilter : null,
    };
  }

  /* ══════════════════════════════ imagens ══════════════════════════════ */

  var assetCache = {};

  function readAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.onerror = function () {
        reject(new Error("falha ao ler blob"));
      };
      reader.readAsDataURL(blob);
    });
  }

  /** Busca o conteúdo de um asset (cacheado). `as: "text" | "dataUrl"`. */
  function fetchAsset(url, as) {
    var key = as + "|" + url;
    if (assetCache[key]) return assetCache[key];
    var promise = fetch(url, { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return as === "text" ? res.text() : res.blob().then(readAsDataUrl);
      })
      .catch(function (err) {
        warn("asset", "Não foi possível carregar " + url + ": " + err.message);
        return null;
      });
    assetCache[key] = promise;
    return promise;
  }

  function absoluteUrl(src) {
    try {
      return new URL(src, location.href).href;
    } catch {
      return null;
    }
  }

  function isSvgSrc(src) {
    return /\.svg(\?|#|$)/i.test(src);
  }

  /* ══════════════════════════════ árvore ══════════════════════════════ */

  var nodeCount = 0;
  var hoisted = [];
  var proximoNodeId = 0;

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, TITLE: 1 };

  var MAPA_JUSTIFY = {
    "flex-start": "MIN", start: "MIN", normal: "MIN",
    center: "CENTER",
    "flex-end": "MAX", end: "MAX",
    "space-between": "SPACE_BETWEEN",
    "space-around": "SPACE_AROUND",
    "space-evenly": "SPACE_EVENLY",
  };

  var MAPA_ALIGN = {
    "flex-start": "MIN", start: "MIN", normal: "MIN",
    center: "CENTER",
    "flex-end": "MAX", end: "MAX",
    baseline: "BASELINE",
  };

  /**
   * Infere auto-layout para contêineres flex.
   *
   * Só é aplicado quando o resultado é previsível: fluxo unidimensional,
   * sem filhos fora do fluxo (absolute) e sem margens — casos em que o modelo
   * do Figma reproduz o flexbox fielmente. Qualquer outra situação continua
   * posicionada de forma absoluta (com o PNG de referência como garantia).
   */
  function aplicarLayout(node, cs) {
    if (node.kind !== "frame") return;
    // `inline-flex` também é fluxo flex e pode virar auto-layout.
    if (cs.display !== "flex" && cs.display !== "inline-flex") return;
    if (cs.flexWrap === "wrap") return;
    if (cs.flexDirection === "row-reverse" || cs.flexDirection === "column-reverse") return;

    var filhos = node.children || [];
    if (filhos.length === 0) return;

    var indiceAuto = -1;
    for (var i = 0; i < filhos.length; i++) {
      var f = filhos[i];
      if (f.outOfFlow) return;
      var auto =
        f.marginAuto && (f.marginAuto[0] || f.marginAuto[1] || f.marginAuto[2] || f.marginAuto[3]);
      if (auto) {
        if (indiceAuto >= 0) return; // mais de uma margem automática: não modelamos
        indiceAuto = i;
      } else if (f.margin && (f.margin[0] || f.margin[1] || f.margin[2] || f.margin[3])) {
        return; // margem fixa não existe em auto-layout: mantém posicionamento absoluto
      }
    }

    var horizontal = cs.flexDirection === "row";
    var justificativa = MAPA_JUSTIFY[cs.justifyContent] || "MIN";

    // `margin-left:auto` empurra o último item para a direita. Com exatamente
    // dois filhos isso equivale a SPACE_BETWEEN; com mais filhos as posições
    // intermediárias seriam outras, então mantemos o posicionamento absoluto.
    var espacoEntre = false;
    if (indiceAuto >= 0) {
      var ultimoEmpurrado = indiceAuto === filhos.length - 1 && filhos.length === 2;
      if (horizontal && ultimoEmpurrado && justificativa === "MIN") espacoEntre = true;
      else return;
    }
    var pt = px(cs.paddingTop);
    var pr = px(cs.paddingRight);
    var pb = px(cs.paddingBottom);
    var pl = px(cs.paddingLeft);
    var gap = horizontal ? px(cs.columnGap) : px(cs.rowGap);

    var contentW = Math.max(0, node.box.w - pl - pr);
    var contentH = Math.max(0, node.box.h - pt - pb);

    node.layout = {
      mode: horizontal ? "HORIZONTAL" : "VERTICAL",
      gap: gap,
      padding: [pt, pr, pb, pl],
      primaryAlign: espacoEntre ? "SPACE_BETWEEN" : justificativa,
      counterAlign: MAPA_ALIGN[cs.alignItems] || "MIN",
      // Componentes cujo tamanho é intrínseco (ex.: Button `inline-flex`) devem
      // abraçar o conteúdo no eixo principal, para reagir a rótulo/ícones.
      hug:
        node.hug === (horizontal ? "horizontal" : "vertical") ||
        (!!node.componente && node.hug === "ambos"),
    };

    for (var j = 0; j < filhos.length; j++) {
      var filho = filhos[j];
      filho.grow = !!filho.flexGrow;
      var tamanhoCruzado = horizontal ? filho.box.h : filho.box.w;
      var conteudoCruzado = horizontal ? contentH : contentW;
      filho.stretch =
        cs.alignItems === "stretch" &&
        (filho.alignSelf === "auto" || filho.alignSelf === "stretch") &&
        Math.abs(tamanhoCruzado - conteudoCruzado) <= 1.5;
    }
  }

  /** Marcas `data-figma*` deixadas nos componentes da aplicação. */
  function marcasDe(el) {
    if (!el.getAttribute) return null;
    var componente = null;
    var props = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var atributo = el.attributes[i];
      if (atributo.name === "data-figma") componente = atributo.value;
      else if (atributo.name.indexOf("data-figma-") === 0) {
        props[atributo.name.slice("data-figma-".length)] = atributo.value;
      }
    }
    if (!componente && Object.keys(props).length === 0) return null;
    return { componente: componente, props: props };
  }

  function visit(el) {
    if (SKIP_TAGS[el.tagName]) return [];
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return [];
    if (Number(cs.opacity) === 0 && el.tagName !== "HTML") return [];

    var rect = el.getBoundingClientRect();
    var tag = el.tagName.toLowerCase();
    var isSvgRoot = tag === "svg";
    var isImg = tag === "img";

    // display:contents não gera caixa — os filhos sobem um nível
    if (cs.display === "contents" && !isImg && !isSvgRoot) {
      var flat = [];
      for (var c = 0; c < el.children.length; c++) {
        var sub = visit(el.children[c]);
        for (var k = 0; k < sub.length; k++) flat.push(sub[k]);
      }
      return flat;
    }

    if (rect.width <= 0 && rect.height <= 0) return [];
    if (rect.bottom <= 0 || rect.top >= VH || rect.right <= 0 || rect.left >= VW) {
      // totalmente fora do viewport: nada visível
      return [];
    }

    nodeCount++;
    if (nodeCount > MAX_NODES) {
      warn("budget", "Limite de " + MAX_NODES + " nós atingido; a tela foi truncada.");
      return [];
    }

    var node = {
      tag: tag,
      name: tag,
      nodeId: ++proximoNodeId,
      box: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      style: styleOf(el, cs),
      clip: cs.overflowX !== "visible" || cs.overflowY !== "visible",
      children: [],
      kind: "frame",
      fixed: cs.position === "fixed",
      outOfFlow: cs.position === "absolute",
      flexGrow: px(cs.flexGrow) > 0,
      alignSelf: cs.alignSelf || "auto",
      margin: [px(cs.marginTop), px(cs.marginRight), px(cs.marginBottom), px(cs.marginLeft)],
      marginAuto: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(function (v) {
        return String(v).trim() === "auto";
      }),
    };

    if (cs.transform && cs.transform !== "none") node.transformado = true;

    var marcas = marcasDe(el);
    if (marcas) {
      if (marcas.componente) node.componente = marcas.componente;
      var props = {};
      for (var chave in marcas.props) {
        if (chave === "slot") node.slot = marcas.props[chave];
        else if (chave === "icon") node.iconName = marcas.props[chave];
        else if (chave === "hug") node.hug = marcas.props[chave];
        else props[chave] = marcas.props[chave];
      }
      if (Object.keys(props).length > 0) node.componentProps = props;
    }

    /* ── vetor / raster ── */
    if (isSvgRoot) {
      var svgColor = parseColor(cs.color);
      var markup = el.outerHTML;
      if (svgColor) {
        markup = markup
          .replace(/currentColor/g, "rgb(" + Math.round(svgColor.r * 255) + "," + Math.round(svgColor.g * 255) + "," + Math.round(svgColor.b * 255) + ")")
          .replace(/\sstyle="[^"]*"/g, "");
      }
      node.kind = "svg";
      node.svg = markup;
      node.style = null;
      return assign(node) ? [] : [node];
    }

    if (isImg) {
      var src = el.currentSrc || el.getAttribute("src") || "";
      var url = src ? absoluteUrl(src) : null;
      node.style = null;
      // Nome do ícone a partir do arquivo (ex.: /icons/actions/Lupa.svg → Lupa)
      var nomeDoArquivo = String(src).match(/([^/\\]+)\.svg(?:\?|#|$)/i);
      if (nomeDoArquivo) {
        node.iconName = nomeDoArquivo[1];
      }
      if (!url) {
        // imagem quebrada: mantém como retângulo vazio para preservar o layout
        node.kind = "frame";
        node.style = { bg: null, border: null, radius: [0, 0, 0, 0], shadows: [], opacity: 1 };
        return assign(node) ? [] : [node];
      }
      if (isSvgSrc(url)) {
        node.kind = "svg";
        node.svg = null;
        node.svgUrl = url;
        if (el.alt) node.name = "img " + el.alt;
        return assign(node) ? [] : [node];
      }
      node.kind = "image";
      node.imgUrl = url;
      node.objectFit = cs.objectFit || "fill";
      if (el.alt) node.name = "img " + el.alt;
      return assign(node) ? [] : [node];
    }

    /* ── texto e filhos, na ordem do DOM ──
     * A ordem importa: em auto-layout o Figma posiciona os filhos na ordem do
     * array. Empurrar o texto primeiro colocaria o rótulo antes do ícone. */
    var textoProprio = ownTextSpec(el, cs, rect);
    var textoInserido = false;

    for (var i = 0; i < el.childNodes.length; i++) {
      var filho = el.childNodes[i];
      if (filho.nodeType === 3) {
        if (!textoInserido && textoProprio && filho.nodeValue && filho.nodeValue.trim()) {
          node.children.push(textoProprio);
          textoInserido = true;
        }
        continue;
      }
      if (filho.nodeType !== 1) continue;
      var kids = visit(filho);
      for (var j = 0; j < kids.length; j++) node.children.push(kids[j]);
    }
    if (!textoInserido && textoProprio) node.children.push(textoProprio);

    aplicarLayout(node, cs);
    return assign(node) ? [] : [node];
  }

  /** Marca o nó. Devolve `true` quando ele foi içado (posição fixa). */
  function assign(node) {
    if (node.fixed) {
      // Elementos fixos (modais, avisos) sobem para a raiz para não serem
      // recortados pelos ancestrais com overflow. CUIDADO: o nó içado não pode
      // voltar para o pai, senão aparece duas vezes na tela.
      delete node.fixed;
      hoisted.push(node);
      return true;
    }
    if (node.kind === "frame" && node.style) {
      var st = node.style;
      node.visual = !!(
        st.bg ||
        st.bgImageUrl ||
        st.border ||
        (st.shadows && st.shadows.length) ||
        (st.opacity !== 1) ||
        st.filter ||
        st.blur ||
        node.clip ||
        node.componente
      );
    }
    return false;
  }

  // pontos de entrada: o corpo e o portal de dev do Next (içados entram depois)
  var roots = [];
  var bodyKids = visit(document.body);
  for (var b = 0; b < bodyKids.length; b++) roots.push(bodyKids[b]);

  var root = {
    tag: "frame",
    name: "viewport",
    kind: "frame",
    box: { x: 0, y: 0, w: VW, h: VH },
    style: { bg: { r: 1, g: 1, b: 1, a: 1 }, border: null, radius: [0, 0, 0, 0], shadows: [], opacity: 1 },
    clip: true,
    visual: true,
    children: roots.concat(hoisted),
  };

  /* ══════════════════════════════ poda ══════════════════════════════ */

  function sameBox(a, b, tol) {
    return (
      Math.abs(a.x - b.x) <= tol &&
      Math.abs(a.y - b.y) <= tol &&
      Math.abs(a.w - b.w) <= tol &&
      Math.abs(a.h - b.h) <= tol
    );
  }

  /**
   * Colapsa invólucros sem efeito visual que têm exatamente um filho ocupando
   * a mesma caixa (típico de `flex-1` / `min-w-0` do Tailwind).
   */
  function prune(node) {
    if (!node.children || node.children.length === 0) return node;
    var kids = [];
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      if (child.kind === "frame" && child.children) {
        child = prune(child);
        while (
          child.kind === "frame" &&
          !child.visual &&
          !child.clip &&
          !child.componente &&
          !child.slot &&
          child.children.length === 1 &&
          child.children[0].kind !== "text" &&
          sameBox(child.box, child.children[0].box, 0.75)
        ) {
          child = child.children[0];
        }
      }
      kids.push(child);
    }
    node.children = kids;
    return node;
  }

  root = prune(root);

  // remove caixas vazias e sem efeito visual
  function strip(node) {
    if (node.kind !== "frame" || !node.children) return node;
    var kept = [];
    for (var i = 0; i < node.children.length; i++) {
      var child = strip(node.children[i]);
      if (child.kind === "frame" && child.children.length === 0 && !child.visual) continue;
      kept.push(child);
    }
    node.children = kept;
    return node;
  }

  root = strip(root);

  /* ══════════════════════════════ serialização ══════════════════════════════ */

  var styles = [];
  var styleIndex = new Map();

  function intern(style) {
    if (!style) return -1;
    var key = JSON.stringify(style);
    var idx = styleIndex.get(key);
    if (idx === undefined) {
      idx = styles.length;
      styles.push(style);
      styleIndex.set(key, idx);
    }
    return idx;
  }

  function serialize(node, parentBox) {
    var out = {
      kind: node.kind,
      name: node.name,
      x: round(node.box.x - parentBox.x),
      y: round(node.box.y - parentBox.y),
      w: round(node.box.w),
      h: round(node.box.h),
    };

    if (node.componente) {
      out.componente = node.componente;
      if (node.componentProps) out.componentProps = node.componentProps;
      var rotulo = node.componentProps && node.componentProps.label;
      out.name = node.componente + (rotulo ? " · " + rotulo : "");
    }

    if (node.slot) out.slot = node.slot;
    if (node.iconName) out.iconName = node.iconName;
    if (node.hug) out.hug = node.hug;
    if (node.nodeId) out.n = node.nodeId;

    if (node.kind === "text") {
      out.text = node.text;
      return out;
    }

    if (node.kind === "svg") {
      if (node.svg) out.svg = node.svg;
      if (node.svgUrl) out.svgUrl = node.svgUrl;
      return out;
    }

    if (node.kind === "image") {
      out.imgUrl = node.imgUrl;
      out.imgData = node.imgData;
      out.objectFit = node.objectFit;
      return out;
    }

    out.style = intern(node.style);
    if (node.clip) out.clip = true;
    if (node.layout) out.layout = node.layout;

    if (node.children && node.children.length) {
      out.children = [];
      for (var i = 0; i < node.children.length; i++) {
        var filho = node.children[i];
        var serializado = serialize(filho, node.box);
        if (node.layout && filho.kind === "frame") {
          if (filho.grow) serializado.grow = 1;
          if (filho.stretch) serializado.stretch = 1;
        }
        out.children.push(serializado);
      }
    }
    return out;
  }

  var serialized = serialize(root, { x: 0, y: 0 });

  /* ══════════════════════════ resolução de assets ══════════════════════════ */

  var EMPTY_STYLE = { bg: null, border: null, radius: [0, 0, 0, 0], shadows: [], opacity: 1 };

  /**
   * Traz para dentro da especificação o conteúdo dos assets:
   *   - SVG → markup inline (vetor de verdade no Figma);
   *   - raster → data URL (decodificada pelo plugin, sem depender de rede).
   * Isso evita que o Figma precise buscar URLs da aplicação.
   */
  async function resolveAssets(node) {
    if (node.svgUrl) {
      var markup = await fetchAsset(node.svgUrl, "text");
      delete node.svgUrl;
      if (markup) {
        node.svg = markup;
      } else {
        node.kind = "frame";
        node.style = intern(EMPTY_STYLE);
      }
    } else if (node.imgUrl) {
      var dataUrl = await fetchAsset(node.imgUrl, "dataUrl");
      delete node.imgUrl;
      if (dataUrl) {
        node.imgData = dataUrl;
      } else {
        node.kind = "frame";
        node.style = intern(EMPTY_STYLE);
      }
    }
    var kids = node.children || [];
    var pending = [];
    for (var i = 0; i < kids.length; i++) pending.push(resolveAssets(kids[i]));
    if (pending.length) await Promise.all(pending);
    return node;
  }

  return resolveAssets(serialized).then(function () {
    return {
      root: serialized,
      styles: styles,
      warnings: warnings,
      stats: { nodes: nodeCount, styles: styles.length, hoisted: hoisted.length },
    };
  });
}
