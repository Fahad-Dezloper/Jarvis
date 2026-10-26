// Shared state of the in-app browsers (Chrome and Safari): search results,
// opened articles, and the search that is currently on screen.
import { create } from "zustand";
import { buildResults, cleanQuery, parseInternalUrl } from "./searchCore.js";

const keyOf = (q, source) => `${source}:${cleanQuery(q).toLowerCase()}`;

const useBrowserStore = create((set, get) => ({
  searches: {},
  articles: {},
  /** key of the most recent search shown, used by open_result */
  currentKey: null,
  loading: {},

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
}));

export default useBrowserStore;

/** Run a search (server route first, curated fallback) and store the result set. */
export async function runSearch(q, source = "web") {
  const query = cleanQuery(q);
  const src = source === "papers" ? "papers" : "web";
  const store = useBrowserStore.getState();
  const cached = store.getSearch(query, src);
  if (cached && !cached.offline) {
    store.setCurrent(query, src);
    return cached;
  }
  let result = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&source=${src}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j.results))
        result = { notes: [], offline: false, ...j, query, source: src };
    }
  } catch {
    /* fall through to the curated snapshot */
  }
  if (!result) {
    result = buildResults(query, src, { arxiv: null });
    if (src === "web") result.offline = false;
    else if (!result.notes.some((n) => /offline/i.test(n))) result.notes.push("offline snapshot");
  }
  useBrowserStore.getState().putSearch(result);
  return result;
}

/** Tab title for an orry:// URL. */
export function titleForInternalUrl(url) {
  const p = parseInternalUrl(url);
  if (!p) return null;
  if (p.type === "search") return p.q ? `${p.q} - Search` : "Search";
  return useBrowserStore.getState().getArticle(p.id)?.title || "Article";
}
