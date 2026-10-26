// Shared state of the in-app browsers (Chrome and Safari): search results,
// opened articles, reader pages, and the search that is currently on screen.
import { create } from "zustand";
import { buildResults, cleanQuery, isHttpUrl, normalizeSource, parseInternalUrl } from "./searchCore.js";

const keyOf = (q, source) => `${source}:${cleanQuery(q).toLowerCase()}`;
const pageKey = (url) => String(url || "").split("#")[0];

const useBrowserStore = create((set, get) => ({
  searches: {},
  articles: {},
  /** key of the most recent search shown, used by open_result */
  currentKey: null,
  loading: {},
  /** reader pages by URL: { status: "loading"|"ok"|"error", data?, error? } */
  pages: {},

  putSearch: (set_) =>
    set((s) => {
      const articles = { ...s.articles };
      for (const r of set_.results) articles[r.id] = r;
      const key = keyOf(set_.query, set_.source);
      return { searches: { ...s.searches, [key]: set_ }, articles, currentKey: key };
    }),
  setCurrent: (q, source) => set({ currentKey: keyOf(q, source) }),
  getSearch: (q, source) => get().searches[keyOf(q, source)] || null,
  getCurrentSearch: () => (get().currentKey ? get().searches[get().currentKey] || null : null),
  getArticle: (id) => get().articles[id] || null,

  getPage: (url) => get().pages[pageKey(url)] || null,
  putPage: (url, entry) => set((s) => ({ pages: { ...s.pages, [pageKey(url)]: entry } })),
  dropPage: (url) =>
    set((s) => {
      const pages = { ...s.pages };
      delete pages[pageKey(url)];
      return { pages };
    }),
  dropSearch: (q, source) =>
    set((s) => {
      const searches = { ...s.searches };
      delete searches[keyOf(q, source)];
      return { searches };
    }),
}));

export default useBrowserStore;

const withTimeout = async (url, ms) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Run a search (server route first, small offline sample as the last resort)
 * and store the result set. source: web | news | papers.
 */
export async function runSearch(q, source = "web", { force = false } = {}) {
  const query = cleanQuery(q);
  const src = normalizeSource(source);
  const store = useBrowserStore.getState();
  const cached = store.getSearch(query, src);
  if (cached && !cached.offline && !force) {
    store.setCurrent(query, src);
    return cached;
  }
  let result = null;
  try {
    const res = await withTimeout(
      `/api/web/search?q=${encodeURIComponent(query)}&source=${src}`,
      10_000,
    );
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j.results)) result = { notes: [], offline: false, ...j, query, source: src };
    }
  } catch {
    /* fall through to the offline sample */
  }
  if (!result) {
    result = buildResults(query, src === "papers" ? "papers" : "web", { arxiv: null });
    result.source = src;
    result.provider = "offline sample";
    result.offline = true;
    if (src === "papers" && !result.notes.some((n) => /offline/i.test(n)))
      result.notes.push("offline snapshot");
  }
  useBrowserStore.getState().putSearch(result);
  return result;
}

const inflight = new Map();

/**
 * Load a page through the server-side reader. Resolves to the store entry
 * ({status:"ok", data} or {status:"error", error:{code,message}}); never throws.
 */
export function loadPage(url, { force = false } = {}) {
  const key = pageKey(url);
  if (!isHttpUrl(key))
    return Promise.resolve({
      status: "error",
      error: { code: "invalid", message: "Only http and https pages can be opened." },
    });
  const store = useBrowserStore.getState();
  const cur = store.getPage(key);
  if (!force && cur && cur.status === "ok") return Promise.resolve(cur);
  if (inflight.has(key)) return inflight.get(key);
  store.putPage(key, { status: "loading" });
  const job = (async () => {
    let entry;
    try {
      const res = await withTimeout(`/api/web/page?url=${encodeURIComponent(key)}`, 12_000);
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) entry = { status: "ok", data: j };
      else
        entry = {
          status: "error",
          error: {
            code: j?.error || "fetch_failed",
            message: j?.message || `The reader answered with HTTP ${res.status}.`,
          },
        };
    } catch (e) {
      entry =
        e?.name === "AbortError"
          ? { status: "error", error: { code: "timeout", message: "The page took too long to load." } }
          : { status: "error", error: { code: "fetch_failed", message: "The reader could not be reached." } };
    }
    useBrowserStore.getState().putPage(key, entry);
    inflight.delete(key);
    return entry;
  })();
  inflight.set(key, job);
  return job;
}

/** Tab title for a jarvis:// URL. */
export function titleForInternalUrl(url) {
  const p = parseInternalUrl(url);
  if (!p) return null;
  if (p.type === "search") return p.q ? `${p.q} - Search` : "Search";
  if (p.type === "page") {
    const e = useBrowserStore.getState().getPage(p.url);
    if (e?.data?.title) return e.data.title;
    try {
      return new URL(p.url).hostname.replace(/^www\./, "");
    } catch {
      return "Page";
    }
  }
  return useBrowserStore.getState().getArticle(p.id)?.title || "Article";
}

/** Re-fetch what a jarvis:// URL shows (reader page or search). Returns true when handled. */
export function reloadInternal(url) {
  const p = parseInternalUrl(url);
  const store = useBrowserStore.getState();
  if (p?.type === "page") {
    loadPage(p.url, { force: true });
    return true;
  }
  if (p?.type === "search") {
    store.dropSearch(p.q, p.source);
    return true;
  }
  return false;
}
