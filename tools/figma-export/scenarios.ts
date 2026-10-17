/**
 * Catálogo de telas/estados exportados para o Figma.
 *
 * Cada cenário vira um par de frames no Figma:
 *   `<id> · EDIT`  — reconstrução vetorial (editável)
 *   `<id> · REF`   — captura PNG 1:1 (gabarito travado)
 *
 * Este arquivo é a única fonte do escopo da exportação: para exportar menos,
 * remova entradas; para exportar só algumas, use `npm run figma:harvest -- --only <id>`.
 */

export interface ScenarioStep {
  /** Clica no primeiro elemento que casar. Aceita seletor CSS ou texto visível. */
  click?: string;
  /**
   * Quando declarado junto de um `click`, a espera é feita aqui e o clique é
   * repetido até o alvo aparecer — necessário porque em `next dev` o primeiro
   * clique pode acontecer antes da hidratação do React.
   */
  waitFor?: string;
  /** Preenche um campo por seletor CSS. */
  fill?: { selector: string; value: string };
  /** Espera um seletor CSS aparecer. */
  waitForOnly?: string;
  /** Espera um texto aparecer na página. */
  waitForText?: string;
  /** Espera fixa em milissegundos. */
  waitMs?: number;
}

export interface Scenario {
  /** Identificador estável — é também o nome dos frames no Figma. */
  id: string;
  group: string;
  title: string;
  route: string;
  /** `true` = precisa de sessão autenticada. Default: `true`. */
  auth?: boolean;
  /** `1` = banco vazio (sem admin). `2` = banco com fixtures. Default: `2`. */
  pass?: 1 | 2;
  steps?: ScenarioStep[];
  /** Não gera o PNG de referência (economiza espaço). */
  skipRef?: boolean;
}

/** Elementos do shell de desenvolvimento que não fazem parte da tela. */
export const GLOBAL_HIDE = ["nextjs-portal", "[data-nextjs-toast]", "#__next-build-watcher"];

const MODAL = "div.fixed.inset-0";

interface Tela {
  slug: string;
  /** Título da página (header do DashboardLayout). */
  titulo: string;
  busca: string;
  /** A tela não implementa busca na listagem (ex.: Perfis). */
  semBusca?: boolean;
}

/** Telas de cadastro com CRUD em modal — todas seguem o mesmo padrão de interação. */
const TELAS: Tela[] = [
  { slug: "usuarios", titulo: "Usuários", busca: "Pesquisar usuários..." },
  { slug: "funcionarios", titulo: "Funcionários", busca: "Pesquisar funcionários..." },
  { slug: "destinatarios", titulo: "Destinatários", busca: "Pesquisar destinatários..." },
  { slug: "fornecedores", titulo: "Fornecedores", busca: "Pesquisar fornecedores..." },
  { slug: "veiculos", titulo: "Veículos", busca: "Pesquisar veículos..." },
  { slug: "produtos", titulo: "Produtos", busca: "Pesquisar produtos..." },
  { slug: "perfis", titulo: "Perfis", busca: "Pesquisar perfis...", semBusca: true },
];

const CAMPO_BUSCA = (placeholder: string) => `input[placeholder="${placeholder}"]`;

/** Cenários de uma tela de cadastro: lista + estado vazio + os quatro modais. */
function cenariosCadastro(tela: Tela): Scenario[] {
  const { slug, titulo, busca, semBusca } = tela;
  const base = { group: "Cadastros", route: `/${slug}` };

  const listaVazia: Scenario[] = semBusca
    ? []
    : [
        {
          ...base,
          id: `${slug}/lista-vazia`,
          title: `${titulo} — Busca sem resultados`,
          steps: [
            { fill: { selector: CAMPO_BUSCA(busca), value: "zzzzzzzz" } },
            { waitForText: "Nenhum registro encontrado." },
            { waitMs: 200 },
          ],
        },
      ];

  return [
    {
      ...base,
      id: `${slug}/lista`,
      title: `${titulo} — Listagem`,
    },
    ...listaVazia,
    {
      ...base,
      id: `${slug}/modal-novo`,
      title: `${titulo} — Modal Novo`,
      steps: [{ click: "Novo", waitFor: MODAL, waitMs: 300 }],
    },
    {
      ...base,
      id: `${slug}/modal-visualizar`,
      title: `${titulo} — Modal Visualizar`,
      steps: [{ click: 'button[title="Visualizar"]', waitFor: MODAL, waitMs: 500 }],
    },
    {
      ...base,
      id: `${slug}/modal-editar`,
      title: `${titulo} — Modal Editar`,
      steps: [{ click: 'button[title="Editar"]', waitFor: MODAL, waitMs: 500 }],
    },
    {
      ...base,
      id: `${slug}/modal-excluir`,
      title: `${titulo} — Confirmação de exclusão`,
      steps: [{ click: 'button[title="Excluir"]', waitFor: MODAL, waitMs: 300 }],
    },
  ];
}

export const SCENARIOS: Scenario[] = [
  /* ── Passo 1: banco vazio (fluxo de primeiro acesso) ── */
  {
    id: "acesso/primeiro-acesso",
    group: "Acesso",
    title: "Primeiro acesso — Criar administrador",
    route: "/primeiro-acesso",
    auth: false,
    pass: 1,
  },
  {
    id: "acesso/primeiro-acesso-preenchido",
    group: "Acesso",
    title: "Primeiro acesso — Formulário preenchido",
    route: "/primeiro-acesso",
    auth: false,
    pass: 1,
    steps: [
      { fill: { selector: 'input[name="nome"]', value: "Administrador Nexus" } },
      { fill: { selector: 'input[name="login"]', value: "admin@nexus.local" } },
      { fill: { selector: 'input[name="senha"]', value: "nexus1234" } },
      { waitMs: 200 },
    ],
  },

  /* ── Passo 2: telas públicas ── */
  {
    id: "acesso/login",
    group: "Acesso",
    title: "Login",
    route: "/login",
    auth: false,
  },
  {
    id: "acesso/login-erro",
    group: "Acesso",
    title: "Login — credenciais inválidas",
    route: "/login",
    auth: false,
    steps: [
      { fill: { selector: 'input[name="login"]', value: "nao.existe@nexus.local" } },
      { fill: { selector: 'input[name="senha"]', value: "senha-errada" } },
      { click: 'button[type="submit"]', waitFor: '[role="alert"]', waitMs: 300 },
    ],
  },
  {
    id: "acesso/definir-senha",
    group: "Acesso",
    title: "Definir senha",
    route: "/definir-senha",
    auth: false,
  },

  /* ── Dashboard ── */
  {
    id: "dashboard/painel",
    group: "Dashboard",
    title: "Dashboard",
    route: "/dashboard",
  },

  /* ── Cadastros ── */
  ...TELAS.flatMap(cenariosCadastro),
];

export function selecionar(apenas: string[] | undefined): Scenario[] {
  if (!apenas || apenas.length === 0) return SCENARIOS;
  const ids = new Set(apenas);
  const encontrados = SCENARIOS.filter((s) => ids.has(s.id));
  const faltando = [...ids].filter((id) => !SCENARIOS.some((s) => s.id === id));
  if (faltando.length > 0) {
    throw new Error(`Cenário(s) inexistente(s): ${faltando.join(", ")}`);
  }
  return encontrados;
}
