#!/usr/bin/env node
/**
 * scripts/ai-workflow-check.mjs
 *
 * Verifica a INTEGRIDADE da arquitetura de orquestração multiagente do Nexus.
 * Somente leitura — não altera o repositório. Não executa operações externas
 * (Jira/rede) nem destrutivas; os cenários que exigem runtime são marcados MANUAL.
 *
 * Uso: node scripts/ai-workflow-check.mjs
 * Saída: tabela de verificações + código de saída 0 (tudo ok) ou 1 (falha).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const read = (rel) => (existsSync(p(rel)) ? readFileSync(p(rel), "utf8") : null);
const has = (text, re) => typeof text === "string" && re.test(text);

const results = [];
const check = (id, title, ok, detail, manual = false) =>
  results.push({ id, title, ok: manual ? null : !!ok, detail, manual });

// ---- Inventário -----------------------------------------------------------
const AGENTS_DIR = ".opencode/agents";
const SKILLS_DIR = ".opencode/skills";
const EXPECTED_AGENTS = ["orchestrator", "developer", "reviewer", "qa", "docs-keeper", "release-manager"];
const EXPECTED_SKILLS = ["orchestration", "jira-smart-commits", "release"];

const agentFiles = existsSync(p(AGENTS_DIR)) ? readdirSync(p(AGENTS_DIR)).filter((f) => f.endsWith(".md")) : [];
const skillFiles = existsSync(p(SKILLS_DIR))
  ? readdirSync(p(SKILLS_DIR)).filter((d) => existsSync(p(SKILLS_DIR, d, "SKILL.md")))
  : [];

const frontmatter = (text) => {
  const m = text && text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
};

// ---- 2) Contexto delimitado por agente ------------------------------------
const missingAgents = EXPECTED_AGENTS.filter((a) => !agentFiles.includes(`${a}.md`));
const badAgents = [];
for (const a of EXPECTED_AGENTS) {
  const text = read(`${AGENTS_DIR}/${a}.md`);
  const fm = frontmatter(text);
  if (!fm || !has(fm, /description\s*:/) || !has(fm, /mode\s*:/)) {
    badAgents.push(a);
    continue;
  }
  const body = text.replace(/^---[\s\S]*?---/, "");
  if (!has(body, /(Fonte|Fontes|fontes de contexto|contexto autorizad)/i)) badAgents.push(`${a}(sem-fontes)`);
  if (!has(body, /(bloqueio|bloquead|escalon)/i)) badAgents.push(`${a}(sem-bloqueio)`);
  if (!has(body, /(relat[óo]rio|formato)/i)) badAgents.push(`${a}(sem-formato)`);
}
check(2, "Agentes existem e declaram contexto/limites", missingAgents.length === 0 && badAgents.length === 0,
  missingAgents.length ? `faltando: ${missingAgents.join(", ")}` : badAgents.length ? `incompletos: ${badAgents.join(", ")}` : `${EXPECTED_AGENTS.length} agentes ok`);

// ---- 1) Orquestrador é primary e pode delegar -----------------------------
const orchFm = frontmatter(read(`${AGENTS_DIR}/orchestrator.md`));
check(1, "Orquestrador (primary) configurado para delegar",
  orchFm && /mode\s*:\s*primary/.test(orchFm) && /action\s*:\s*subagent/.test(orchFm),
  orchFm ? "mode: primary + permissão subagent" : "orchestrator.md ausente/sem frontmatter");

// ---- 3) Contrato verificável ----------------------------------------------
const contractPath = ".ai-workflow/contracts/TASK_CONTRACT_TEMPLATE.md";
const contract = read(contractPath);
const contractFields = ["Identificação", "Objetivo", "Issues Jira", "Critérios de aceite", "Testes esperados",
  "Branch", "Commit-base", "Status", "Commit SHA", "Riscos", "Bloqueios"];
const missingFields = contractFields.filter((f) => !has(contract, new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")));
check(3, "Contrato de tarefa tem campos verificáveis", missingFields.length === 0,
  missingFields.length ? `faltando: ${missingFields.join(", ")}` : "todos os campos presentes");

// ---- 4) Estado persiste (arquivos versionáveis, não ignorados) ------------
const state = read(".ai-workflow/PROJECT_STATE.md");
const stateFields = ["Objetivo", "Runs", "Bloqueios", "Git", "checkpoint", "Testes", "Próximas ações"];
const missingState = stateFields.filter((f) => !has(state, new RegExp(f, "i")));
check(4, "Estado persistente completo", missingState.length === 0 &&
  existsSync(p(".ai-workflow/runs")) && existsSync(p(".ai-workflow/decisions")),
  missingState.length ? `faltando: ${missingState.join(", ")}` : "PROJECT_STATE + runs/ + decisions/");

// ---- 5) Recuperação documentada -------------------------------------------
const wfReadme = read(".ai-workflow/README.md");
check(5, "Recuperação de estado documentada", has(wfReadme, /retomar|recuper|reconstru/i) && has(wfReadme, /git/i),
  "README descreve como retomar e validar o Git");

// ---- 6) Bloqueio tratado (estado + contrato) ------------------------------
check(6, "Bloqueio tem representação explícita",
  has(state, /bloqueio/i) && has(contract, /bloqueado/i) && has(contract, /falhou/i),
  "status bloqueado/falhou no contrato e seção de bloqueios no estado");

// ---- 7) Falha ≠ sucesso ----------------------------------------------------
check(7, "Falha de agente não é sucesso",
  has(read(`${AGENTS_DIR}/orchestrator.md`), /nunca[^.]*sucesso|não é prova|não confia/i),
  "orquestrador exige verificação independente do relatório");

// ---- 8) Escrita concorrente -------------------------------------------------
check(8, "Escrita concorrente controlada", has(wfReadme, /escritor único|único escritor|propriedade de escrita|um arquivo por|nunca editam o mesmo/i),
  "README define escritor único / arquivo por run");

// ---- 9) QA antes da conclusão ---------------------------------------------
check(9, "QA previsto antes da conclusão",
  has(read(`${AGENTS_DIR}/release-manager.md`), /qa/i) && has(read(".opencode/skills/orchestration/SKILL.md"), /reviewer\s*→\s*qa|qa\s*→/i),
  "ciclo e checklist de release citam QA");

// ---- 10) Changelog só mudanças reais ---------------------------------------
const changelog = read("CHANGELOG.md");
check(10, "Changelog no padrão e com Unreleased",
  has(changelog, /## \[Unreleased\]/) && has(changelog, /Keep a Changelog/i) && has(changelog, /Added|Changed|Fixed/),
  changelog ? "Unreleased + Keep a Changelog + categorias" : "CHANGELOG.md ausente");

// ---- 11) Associação Jira verificável ---------------------------------------
check(11, "Regras de Jira com fonte única",
  has(read(".opencode/skills/jira-smart-commits/SKILL.md"), /docs\/agents\/JIRA\.MD/i) && existsSync(p("docs/agents/JIRA.MD")),
  "skill referencia docs/agents/JIRA.MD (sem duplicar)");

// ---- 12) Release não conclui sem critérios ---------------------------------
check(12, "Release bloqueada sem critérios",
  has(read(".opencode/skills/release/SKILL.md"), /obrigat|bloque|aprovação do usuário/i) &&
  has(read(`${AGENTS_DIR}/release-manager.md`), /bloqueio|não marcar|aprova/i),
  "checklist e release-manager declaram condições de bloqueio", false);

// ---- Skills registradas -----------------------------------------------------
const missingSkills = EXPECTED_SKILLS.filter((s) => !skillFiles.includes(s));
check(13, "Skills de processo presentes", missingSkills.length === 0,
  missingSkills.length ? `faltando: ${missingSkills.join(", ")}` : `${EXPECTED_SKILLS.length} skills ok`);

// ---- Cenários que dependem de runtime (MANUAL) -----------------------------
check(1, "Orquestrador abre e acompanha sessão-filho (runtime)", null,
  "MANUAL: abrir um subagente real e conferir a sessão-filho no cliente", true);
check(5, "Sessão nova reconstrói estado sem histórico", null,
  "MANUAL: iniciar sessão limpa e seguir .ai-workflow/README.md", true);

// ---- Relatório --------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
console.log("\nArquitetura multiagente — verificação de integridade\n" + "=".repeat(64));
let failed = 0, manual = 0;
for (const r of results) {
  const tag = r.manual ? "MANUAL" : r.ok ? "PASS  " : "FAIL  ";
  if (!r.manual && !r.ok) failed++;
  if (r.manual) manual++;
  console.log(`${tag} ${pad(r.id + ".", 4)} ${pad(r.title, 52)} ${r.detail}`);
}
console.log("=".repeat(64));
console.log(`${results.length - manual - failed}/${results.length - manual} automáticos ok · ${manual} manual(is) · ${failed} falha(s)`);
process.exit(failed ? 1 : 0);
