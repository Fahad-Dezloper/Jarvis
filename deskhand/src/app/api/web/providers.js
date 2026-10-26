// Web search providers for /api/web/search. Order of preference:
//   1. Serper (real Google results)          (SERPER_API_KEY)
//   2. Google Programmable Search JSON API   (GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID; closed to new customers)
//   3. Brave Search API                      (BRAVE_SEARCH_API_KEY)
//   4. Gemini Google-Search grounding        (GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY)
//   5. keyless: Wikipedia, Hacker News (Algolia), Marginalia, arXiv (+ Paradigm snapshot for papers)
// Official APIs only. Google/Bing result pages are never scraped.
// Parsers are pure and exported for scripts/check-web.mjs.
import {
  MAX_RESULTS,
  arxivUrl,
  buildResults,
  cleanQuery,
  parseArxivAtom,
} from "../../../module/desktop/apps/chrome/searchCore.js";

export const DEFAULT_TOTAL_MS = 8000;

// ------------------------------------------------------------------ helpers

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decodeEntities = (s) =>
  String(s ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
export const stripTags = (s) =>
  decodeEntities(String(s ?? "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

export function normDate(s) {
  if (!s) return "";
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const t = Date.parse(str);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export function normalizeUrlKey(url) {
  try {
    const u = new URL(url);
    const keep = [...u.searchParams.entries()].filter(([k]) => !/^(utm_|fbclid|gclid|ref$)/i.test(k));
    const q = keep.length ? `?${new URLSearchParams(keep)}` : "";
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${q}`.toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

/** Build one result object in the shape the UI and handlers share. */
export function mkResult({ title, url, snippet = "", date = "", site, provider, kind = "web", extra = {} }) {
  const host = hostOf(url);
  return {
    id: `w-${hash(normalizeUrlKey(url))}`,
    kind,
    title: stripTags(title) || host || url,
    url,
    site: site || host,
    source: site || host,
    snippet: stripTags(snippet).slice(0, 320),
    date: normDate(date),
    authors: [],
    provider,
    ...extra,
  };
}

const isHttp = (u) => /^https?:\/\//i.test(String(u || ""));

export function dedupeResults(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (!r || !isHttp(r.url)) continue;
    const k = normalizeUrlKey(r.url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Take one from each list in turn, keeping each list's own order. */
export function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

const RELAX_STOP = new Set(
  "the a an of on in for to and about by from with me show find search look up please open what is are any best result results latest newest recent new summarise summarize summary read tell give top most good great".split(
    " ",
  ),
);

/** Queries to try in order: as typed, without filler words, then the three longest words. */
export function relaxedQueries(q) {
  const base = cleanQuery(q);
  const words = base.split(" ").filter(Boolean);
  const content = words.filter((w) => !RELAX_STOP.has(w.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const out = [base];
  if (content.length && content.join(" ") !== base) out.push(content.join(" "));
  if (content.length > 3) out.push([...content].sort((a, b) => b.length - a.length).slice(0, 3).join(" "));
  return [...new Set(out)];
}

export async function timedFetch(url, ms, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(200, ms));
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "user-agent": "JarvisReader/1.0 (demo desktop search)", ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

class ProviderError extends Error {}
async function getJson(url, ms, init) {
  const res = await timedFetch(url, ms, init);
  if (!res.ok) throw new ProviderError(`HTTP ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------- key providers

export const googleCseConfigured = () =>
  Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID);
export const braveConfigured = () => Boolean(process.env.BRAVE_SEARCH_API_KEY);
export const serperConfigured = () => Boolean(process.env.SERPER_API_KEY);

/** Serper (google.serper.dev) returns Google results: `organic` for web, `news` for the news endpoint. */
export function parseSerper(json, news = false) {
  const list = news ? json?.news : json?.organic;
  return (list || []).map((it) =>
    mkResult({
      title: it.title,
      url: it.link,
      site: it.source || undefined,
      snippet: it.snippet,
      date: it.date || "",
      provider: "Google (Serper)",
    }),
  );
}

async function serper(q, source, ms) {
  const news = source === "news";
  const json = await getJson(`https://google.serper.dev/${news ? "news" : "search"}`, ms, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.SERPER_API_KEY },
    body: JSON.stringify({ q, num: 10 }),
  });
  return parseSerper(json, news);
}
export const geminiKey = () =>
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "";

export function parseGoogleCse(json) {
  return (json?.items || []).map((it) => {
    const m = it.pagemap?.metatags?.[0] || {};
    return mkResult({
      title: it.title,
      url: it.link,
      site: it.displayLink?.replace(/^www\./, ""),
      snippet: it.snippet,
      date: m["article:published_time"] || m["og:updated_time"] || m["date"] || "",
      provider: "Google",
    });
  });
}

async function googleCse(q, source, ms) {
  const p = new URLSearchParams({
    key: process.env.GOOGLE_CSE_API_KEY,
    cx: process.env.GOOGLE_CSE_ID,
    q,
    num: "10",
  });
  if (source === "news") p.set("sort", "date");
  return parseGoogleCse(await getJson(`https://www.googleapis.com/customsearch/v1?${p}`, ms));
}

export function parseBrave(json, news = false) {
  const list = news ? json?.results : json?.web?.results;
  return (list || []).map((it) =>
    mkResult({
      title: it.title,
      url: it.url,
      site: it.meta_url?.hostname?.replace(/^www\./, ""),
      snippet: it.description,
      date: it.page_age || "",
      provider: "Brave",
    }),
  );
}

async function brave(q, source, ms) {
  const news = source === "news";
  const p = new URLSearchParams({ q, count: "10" });
  const json = await getJson(
    `https://api.search.brave.com/res/v1/${news ? "news" : "web"}/search?${p}`,
    ms,
    { headers: { accept: "application/json", "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY } },
  );
  return parseBrave(json, news);
}

const looksLikeDomain = (s) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(s || "").trim());
function titleFromUrl(url) {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
    const words = decodeURIComponent(slug).replace(/\.[a-z0-9]{2,5}$/i, "").split(/[-_+\s]+/).filter(Boolean);
    if (words.length < 2) return "";
    const t = words.join(" ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  } catch {
    return "";
  }
}

/**
 * Convert a Gemini grounded response into results.
 * @param {{text?:string, sources?:{url:string,title?:string,sourceType?:string}[], groundingMetadata?:any}} r
 */
export function parseGeminiGrounding(r) {
  const sources = (r.sources || []).filter((s) => s.sourceType === "url" && isHttp(s.url));
  const supports = r.groundingMetadata?.groundingSupports || [];
  const chunkSnippet = new Map();
  for (const s of supports) {
    const text = (s.segment?.text || s.segment_text || "").trim();
    for (const i of s.groundingChunkIndices || s.supportChunkIndices || []) {
      if (!text) continue;
      const prev = chunkSnippet.get(i) || "";
      if (prev.length < 240) chunkSnippet.set(i, `${prev} ${text}`.trim());
    }
  }
  const summary = String(r.text || "").trim().slice(0, 1200);
  const first = summary.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  const results = sources.map((s, i) => {
    const domainTitle = looksLikeDomain(s.title);
    return mkResult({
      title: !s.title || domainTitle ? titleFromUrl(s.url) || s.title || hostOf(s.url) : s.title,
      url: s.url,
      site: domainTitle ? s.title.replace(/^www\./, "") : undefined,
      snippet: chunkSnippet.get(i) || (i === 0 ? first : ""),
      provider: "Gemini",
    });
  });
  return { results, summary };
}

async function resolveGroundingRedirect(url, ms) {
  if (!/^https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\//.test(url)) return url;
  try {
    const res = await timedFetch(url, ms, { redirect: "manual" });
    const loc = res.headers.get("location");
    return loc && isHttp(loc) ? loc : url;
  } catch {
    return url;
  }
}

async function geminiGrounded(q, source, ms) {
  const key = geminiKey();
  const [{ generateText }, { createGoogleGenerativeAI }, modelMod] = await Promise.all([
    import("ai"),
    import("@ai-sdk/google"),
    import("../../../deskhand/engine/model.js"),
  ]);
  const google = createGoogleGenerativeAI({ apiKey: key });
  const modelId = process.env.DESKHAND_SEARCH_MODEL || modelMod.DEFAULT_GOOGLE_MODEL;
  const ask =
    source === "news"
      ? `Find the latest news about: ${q}`
      : `Search the web for: ${q}. Prefer primary, recent, substantive pages.`;
  const result = await generateText({
    model: google(modelId),
    tools: { google_search: google.tools.googleSearch({}) },
    prompt: `${ask}\nReply with 3 or 4 plain sentences on what the best sources say.`,
    abortSignal: AbortSignal.timeout(Math.max(500, ms)),
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
  });
  const parsed = parseGeminiGrounding({
    text: result.text,
    sources: result.sources,
    groundingMetadata: result.providerMetadata?.google?.groundingMetadata,
  });
  // Grounding links are redirect URLs; resolve them to the real pages when we can.
  const resolved = await Promise.all(parsed.results.map((r) => resolveGroundingRedirect(r.url, 2500)));
  const results = parsed.results.map((r, i) =>
    resolved[i] === r.url
      ? r
      : mkResult({ ...r, url: resolved[i], title: r.title, site: r.site, provider: "Gemini" }),
  );
  return { results, summary: parsed.summary };
}

// ------------------------------------------------------------ keyless sources

export function parseWikipedia(json) {
  return (json?.query?.search || []).map((it) =>
    mkResult({
      title: it.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(it.title).replace(/ /g, "_"))}`,
      site: "en.wikipedia.org",
      snippet: it.snippet,
      provider: "Wikipedia",
    }),
  );
}

export function parseHackerNews(json) {
  return (json?.hits || [])
    .filter((h) => h.title)
    .map((h) => {
      const hnUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
      const url = isHttp(h.url) ? h.url : hnUrl;
      return mkResult({
        title: h.title,
        url,
        snippet: `${h.points ?? 0} points, ${h.num_comments ?? 0} comments on Hacker News`,
        date: h.created_at,
        provider: "Hacker News",
      });
    });
}

export function parseMarginalia(json) {
  return (json?.results || []).map((it) =>
    mkResult({ title: it.title, url: it.url, snippet: it.description, provider: "Marginalia" }),
  );
}

async function firstNonEmpty(q, ms, fetchOne) {
  const tries = relaxedQueries(q);
  const per = Math.max(500, ms / Math.min(tries.length, 2));
  for (const t of tries.slice(0, 3)) {
    try {
      const out = await fetchOne(t, per);
      if (out.length) return out;
    } catch (e) {
      if (t === tries[tries.length - 1] || tries.length === 1) throw e;
    }
  }
  return [];
}

const wikipedia = (q, ms) =>
  firstNonEmpty(q, ms, async (t, per) =>
    parseWikipedia(
      await getJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(t)}&srlimit=6&format=json&utf8=1`,
        per,
      ),
    ),
  );

const hackerNews = (q, source, ms) =>
  firstNonEmpty(q, ms, async (t, per) =>
    parseHackerNews(
      await getJson(
        `https://hn.algolia.com/api/v1/${source === "news" ? "search_by_date" : "search"}?query=${encodeURIComponent(t)}&tags=story&hitsPerPage=8`,
        per,
      ),
    ),
  );

const marginalia = (q, ms) =>
  firstNonEmpty(q, ms, async (t, per) =>
    parseMarginalia(
      await getJson(`https://api.marginalia.nu/public/search/${encodeURIComponent(t)}?count=8`, per),
    ),
  );

async function arxiv(q, ms) {
  const res = await timedFetch(arxivUrl(q), ms);
  if (!res.ok) throw new ProviderError(`HTTP ${res.status}`);
  return parseArxivAtom(await res.text());
}

const wantsResearch = (q) => /\b(research|papers?|stud(?:y|ies)|arxiv|preprints?|literature)\b/i.test(q);

// ------------------------------------------------------------- orchestrator

/**
 * Run a search through the provider chain.
 * @param {string} rawQuery
 * @param {"web"|"news"|"papers"} source
 * @param {{totalMs?:number}} opts
 * @returns {Promise<{query:string, source:string, provider:string, results:object[], notes:string[], offline:boolean, summary?:string, attempts:{provider:string, ok:boolean, detail:string}[]}>}
 */
export async function searchWeb(rawQuery, source = "web", opts = {}) {
  const query = cleanQuery(rawQuery);
  const src = source === "papers" || source === "news" ? source : "web";
  const deadline = Date.now() + (opts.totalMs ?? DEFAULT_TOTAL_MS);
  const left = (reserve = 0, cap = 6000) => Math.max(500, Math.min(cap, deadline - Date.now() - reserve));
  const attempts = [];
  const note = (provider, ok, detail) => attempts.push({ provider, ok, detail });

  if (src === "papers") {
    let arxivList = null;
    try {
      arxivList = await arxiv(query, left(0, 6000));
      note("arXiv", true, `${arxivList.length} results`);
    } catch (e) {
      note("arXiv", false, String(e?.message || e));
    }
    const built = buildResults(query, "papers", { arxiv: arxivList });
    return {
      ...built,
      provider: built.offline ? "Paradigm snapshot (offline)" : "arXiv + Paradigm snapshot",
      attempts,
    };
  }

  // 1-3: providers that need a key. First one that returns results wins.
  const keyed = [];
  if (serperConfigured()) keyed.push(["Google (Serper)", (ms) => serper(query, src, ms), 4000]);
  if (googleCseConfigured()) keyed.push(["Google", (ms) => googleCse(query, src, ms), 4000]);
  if (braveConfigured()) keyed.push(["Brave", (ms) => brave(query, src, ms), 4000]);
  if (geminiKey()) keyed.push(["Gemini (Google Search grounding)", (ms) => geminiGrounded(query, src, ms), 6000]);
  for (const [label, run, cap] of keyed) {
    try {
      const out = await run(left(2500, cap));
      const results = Array.isArray(out) ? out : out.results;
      const clean = dedupeResults(results).slice(0, MAX_RESULTS);
      note(label, clean.length > 0, `${clean.length} results`);
      if (clean.length)
        return {
          query,
          source: src,
          provider: label,
          results: clean,
          notes: [],
          offline: false,
          ...(out.summary ? { summary: out.summary } : {}),
          attempts,
        };
    } catch (e) {
      note(label, false, String(e?.message || e).slice(0, 160));
    }
  }

  // 4: keyless real-web sources, in parallel, merged round-robin.
  const ms = left(0, 5000);
  const jobs = [];
  if (src === "web") jobs.push(["Wikipedia", wikipedia(query, ms)]);
  jobs.push(["Hacker News", hackerNews(query, src, ms)]);
  if (src === "web") jobs.push(["Marginalia", marginalia(query, ms)]);
  if (src === "web" && wantsResearch(query)) jobs.push(["arXiv", arxiv(query, ms)]);
  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const lists = [];
  const used = [];
  settled.forEach((s, i) => {
    const label = jobs[i][0];
    if (s.status === "fulfilled") {
      note(label, s.value.length > 0, `${s.value.length} results`);
      if (s.value.length) {
        lists.push(s.value);
        used.push(label);
      }
    } else note(label, false, String(s.reason?.message || s.reason).slice(0, 160));
  });
  let merged = dedupeResults(interleave(lists)).slice(0, MAX_RESULTS);
  if (src === "news") merged = merged.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (merged.length)
    return {
      query,
      source: src,
      provider: used.join(" + "),
      results: merged,
      notes: [],
      offline: false,
      attempts,
    };

  // Nothing reachable: small offline sample, clearly labelled.
  const built = buildResults(query, "web", {});
  return { ...built, source: src, provider: "offline sample", offline: true, attempts };
}
