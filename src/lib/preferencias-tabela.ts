/**
 * Preferências de colunas das tabelas do sistema, guardadas no IndexedDB do
 * navegador (por navegador, não por usuário).
 *
 * A preferência é acessória: qualquer falha de leitura/escrita é silenciosa e a
 * tabela segue com o padrão (colunas `defaultHidden` ocultas, as demais
 * visíveis). No servidor não existe IndexedDB, então as funções devolvem vazio /
 * não fazem nada.
 */

export interface PreferenciaColunas {
  ocultas: string[];
  /**
   * Chaves de colunas que existiam quando a preferência foi salva. Uma coluna
   * fora desta lista é nova: ela nasce com o próprio padrão (`defaultHidden`),
   * e não com o estado salvo.
   */
  conhecidas?: string[];
  atualizadoEm: number;
}

const NOME_BANCO = "nexus-preferencias";
const VERSAO = 1;
const STORE = "colunas";

/** Promise de abertura cacheada — `open` é chamado uma vez por sessão. */
let abertura: Promise<IDBDatabase> | null = null;

function suportaIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function abrirBanco(): Promise<IDBDatabase> {
  if (abertura) return abertura;

  abertura = new Promise<IDBDatabase>((resolve, reject) => {
    const requisicao = indexedDB.open(NOME_BANCO, VERSAO);

    requisicao.onupgradeneeded = () => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains(STORE)) {
        banco.createObjectStore(STORE);
      }
    };

    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () =>
      reject(requisicao.error ?? new Error("Falha ao abrir o IndexedDB."));
    requisicao.onblocked = () =>
      reject(new Error("Abertura do IndexedDB bloqueada por outra aba."));
  });

  // Uma falha não deve envenenar a sessão: a próxima chamada tenta de novo.
  void abertura.catch(() => {
    abertura = null;
  });

  return abertura;
}

/**
 * Converte o valor gravado em `PreferenciaColunas`; `null` quando não existe
 * registro (ou o formato é desconhecido).
 */
function normalizarPreferencia(valor: unknown): PreferenciaColunas | null {
  if (typeof valor !== "object" || valor === null) return null;

  const registro = valor as {
    ocultas?: unknown;
    conhecidas?: unknown;
    atualizadoEm?: unknown;
  };
  if (!Array.isArray(registro.ocultas)) return null;

  const preferencia: PreferenciaColunas = {
    ocultas: registro.ocultas.filter(
      (chave): chave is string => typeof chave === "string",
    ),
    atualizadoEm:
      typeof registro.atualizadoEm === "number" ? registro.atualizadoEm : 0,
  };
  if (Array.isArray(registro.conhecidas)) {
    preferencia.conhecidas = registro.conhecidas.filter(
      (chave): chave is string => typeof chave === "string",
    );
  }
  return preferencia;
}

/**
 * Preferência salva para a tabela; `null` quando nunca foi salva (distinto de
 * uma preferência vazia, que significa "todas as colunas visíveis") ou quando a
 * leitura falha.
 */
export async function lerColunasOcultas(
  tabela: string,
): Promise<PreferenciaColunas | null> {
  if (!suportaIndexedDB()) return null;

  try {
    const banco = await abrirBanco();
    const valor = await new Promise<unknown>((resolve, reject) => {
      const transacao = banco.transaction(STORE, "readonly");
      const requisicao = transacao.objectStore(STORE).get(tabela);
      requisicao.onsuccess = () => resolve(requisicao.result);
      requisicao.onerror = () =>
        reject(requisicao.error ?? new Error("Falha ao ler a preferência."));
    });
    return normalizarPreferencia(valor);
  } catch {
    return null;
  }
}

/**
 * Substitui o conjunto oculto da tabela. `conhecidas` são as chaves de colunas
 * atuais — o que permite aplicar o padrão de uma coluna nova no futuro. Erros
 * são silenciosos.
 */
export async function salvarColunasOcultas(
  tabela: string,
  ocultas: string[],
  conhecidas: string[],
): Promise<void> {
  if (!suportaIndexedDB()) return;

  try {
    const banco = await abrirBanco();
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction(STORE, "readwrite");
      const valor: PreferenciaColunas = {
        ocultas: [...ocultas],
        conhecidas: [...conhecidas],
        atualizadoEm: Date.now(),
      };
      transacao.objectStore(STORE).put(valor, tabela);
      transacao.oncomplete = () => resolve();
      transacao.onerror = () =>
        reject(transacao.error ?? new Error("Falha ao salvar a preferência."));
      transacao.onabort = () =>
        reject(transacao.error ?? new Error("Gravação da preferência abortada."));
    });
  } catch {
    // Preferência é acessório: a tela continua funcionando com o padrão.
  }
}

/** Remove a preferência (volta ao padrão). Erros são silenciosos. */
export async function limparColunasOcultas(tabela: string): Promise<void> {
  if (!suportaIndexedDB()) return;

  try {
    const banco = await abrirBanco();
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction(STORE, "readwrite");
      transacao.objectStore(STORE).delete(tabela);
      transacao.oncomplete = () => resolve();
      transacao.onerror = () =>
        reject(transacao.error ?? new Error("Falha ao limpar a preferência."));
      transacao.onabort = () =>
        reject(transacao.error ?? new Error("Exclusão da preferência abortada."));
    });
  } catch {
    // Preferência é acessório: a tela continua funcionando com o padrão.
  }
}
