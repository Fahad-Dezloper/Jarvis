// Pure search logic shared by the /api/search route and the Chrome/Safari search page.
// No framework or alias imports: exercised by scripts/check-apps.mjs under tsx.
import { PARADIGM_RESEARCH, PARADIGM_SNAPSHOT_LABEL } from "./data/paradigmResearch.js";
import { WEB_INDEX } from "./data/webIndex.js";

export const MAX_QUERY = 200;
export const MAX_RESULTS = 10;

const FILLER = new Set([
  "the",
  "a",
  "an",
  "of",
  "on",
  "in",
  "for",
  "to",
  "and",
  "about",
  "by",
  "from",
  "with",
  "me",
  "show",
  "find",
  "search",
  "latest",
  "newest",
  "recent",
  "new",
  "papers",
  "paper",
  "research",
  "articles",
  "article",
  "posts",
  "post",
  "writing",
  "please",
  "open",
  "look",
  "up",
  "what",
  "is",
  "are",
  "any",
  "their",
  "its",
  "s",
]);

export function cleanQuery(q) {
  const stripped = [...String(q ?? "")]
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch))
    .join("");
  return stripped.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const words = (s) => norm(s).split(" ").filter(Boolean);
const topicWords = (q) =>
  words(q).filter((w) => !FILLER.has(w) && w !== "paradigm" && w !== "paradigms");

export const isParadigmQuery = (q) => /\bparadigm(?:\.xyz)?\b/i.test(String(q || ""));

/** True when the query asks for nothing beyond "Paradigm's research". */
export const isPlainParadigmQuery = (q) => isParadigmQuery(q) && topicWords(q).length === 0;

// ----------------------------------------------------------------- arXiv

const decodeXml = (s) =>
  String(s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
const squash = (s) => decodeXml(s).replace(/\s+/g, " ").trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : "";
};

/** Parse an arXiv API Atom feed into result objects. Never throws. */
export function parseArxivAtom(xml) {
  const out = [];
  try {
    const entries = String(xml || "").match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const e of entries) {
      const title = squash(tag(e, "title"));
      if (!title) continue;
      const idUrl = squash(tag(e, "id"));
      const published = squash(tag(e, "published"));
      const abstract = squash(tag(e, "summary"));
      const authors = (e.match(/<author>[\s\S]*?<\/author>/g) || [])
        .map((a) => squash(tag(a, "name")))
        .filter(Boolean);
      const arxivId = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
      out.push({
        id: `arxiv-${arxivId}`,
        kind: "paper",
        title,
        source: "arXiv",
        site: "arxiv.org",
        date: published.slice(0, 10),
        authors,
        abstract,
        snippet: abstract.length > 260 ? `${abstract.slice(0, 257).trimEnd()}...` : abstract,
        url: idUrl.replace(/^http:/, "https:"),
      });
    }
  } catch {
    /* return what we have */
  }
  return out;
}

export function arxivUrl(q, max = 8) {
  const terms = topicWords(q).length ? topicWords(q) : words(q);
  const query = terms
    .slice(0, 8)
    .map((w) => `all:${encodeURIComponent(w)}`)
    .join("+AND+");
  return `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&start=0&max_results=${max}`;
}

// ------------------------------------------------------------- curated sets

function paradigmResults(q) {
  const tw = topicWords(q);
  let list = PARADIGM_RESEARCH;
  if (tw.length) {
    list = list.filter((p) => {
      const hay = norm(`${p.title} ${p.summary || ""}`);
      return tw.some((w) => hay.includes(w));
    });
  }
  return [...list]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p, i) => ({
      id: `paradigm-${p.url.split("/").pop()}`,
      kind: "research",
      title: p.title,
      source: "Paradigm Research",
      site: "paradigm.xyz",
      date: p.date,
      authors: p.authors || [],
      abstract: p.summary || "",
      snippet:
        p.summary ||
        `Post on Paradigm's writing page (${p.date}). The full text is on paradigm.xyz; use Open original.`,
      url: p.url,
      curated: true,
      rank: i,
    }));
}

function webResults(q) {
  const qw = words(q).filter((w) => !FILLER.has(w));
  if (!qw.length) return [];
  const scored = WEB_INDEX.map((p) => {
    const title = norm(p.title);
    const rest = norm(`${p.snippet} ${p.topic} ${p.site} ${p.paragraphs.join(" ")}`);
    let score = 0;
    for (const w of qw) {
      if (title.includes(w)) score += 3;
      else if (p.topic === w) score += 3;
      else if (rest.includes(w)) score += 1;
    }
    return { p, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.date.localeCompare(a.p.date));
  return scored.slice(0, MAX_RESULTS).map(({ p }) => ({
    id: p.id,
    kind: "web",
    title: p.title,
    source: p.site,
    site: p.site,
    date: p.date,
    authors: [],
    abstract: p.paragraphs.join("\n\n"),
    snippet: p.snippet,
    url: p.url,
    demo: true,
  }));
}

/**
 * Combine curated and live results for a search.
 * @param {string} q
 * @param {"papers"|"web"} source
 * @param {{arxiv?: object[]|null}} live  arxiv: parsed results, or null/undefined when the network call failed.
 */
export function buildResults(q, source, live = {}) {
  const query = cleanQuery(q);
  const notes = [];
  let results = [];
  let offline = false;
  if (source === "web") {
    results = webResults(query);
    notes.push("Demo web index: invented pages, not the real web.");
  } else {
    const wantsParadigm = isParadigmQuery(query);
    if (wantsParadigm) {
      results.push(...paradigmResults(query).slice(0, MAX_RESULTS));
      notes.push(`Paradigm Research list is a ${PARADIGM_SNAPSHOT_LABEL}.`);
    }
    const wantArxiv = !wantsParadigm || topicWords(query).length > 0;
    if (wantArxiv) {
      if (live.arxiv) results.push(...live.arxiv);
      else {
        offline = true;
        notes.push("arXiv could not be reached: offline snapshot only.");
      }
    }
    if (!wantsParadigm && offline && !results.length) {
      // Offline and not about Paradigm: fall back to any curated post that matches.
      results.push(...paradigmResults(query).slice(0, 5));
    }
  }
  return { query, source, results: results.slice(0, MAX_RESULTS), offline, notes };
}

// ------------------------------------------------------- selection and text

export const byDateDesc = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));

/** Pick a result: 'latest', 'first', a number, or fuzzy title text. Returns {result, index} or null. */
export function selectResult(results, which) {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return null;
  const w = norm(which);
  const pick = (i) => (i >= 0 && i < list.length ? { result: list[i], index: i } : null);
  if (!w || /^(first|1st|top|top result)$/.test(w)) return pick(0);
  if (/^(last)$/.test(w)) return pick(list.length - 1);
  const rest = w
    .replace(/\b(latest|newest|most|recent|one|paper|result|post|article|the|open)\b/g, "")
    .trim();
  if (/\b(latest|newest|recent)\b/.test(w) && !rest) {
    let best = 0;
    list.forEach((r, i) => {
      if (byDateDesc(r, list[best]) < 0) best = i;
    });
    return pick(best);
  }
  const ord = {
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
  };
  const num = w.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (
    num &&
    w
      .replace(/\d+(st|nd|rd|th)?/, "")
      .replace(/result|number|paper|item|option|no|the|open/g, "")
      .trim() === ""
  ) {
    return pick(Number(num[1]) - 1);
  }
  const ordWord = w
    .replace(/\b(the|one|result|paper|open)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (ord[ordWord]) return pick(ord[ordWord] - 1);
  const qt = words(which).filter((t) => !FILLER.has(t));
  let best = -1;
  let bestScore = 0;
  list.forEach((r, i) => {
    const title = norm(r.title);
    let s = 0;
    if (title.includes(w)) s += 10;
    for (const t of qt) if (title.includes(t)) s += 2;
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return bestScore >= 2 ? pick(best) : null;
}

/** Numbered lines for HandlerResult.data: '1. Title | date | url'. */
export function formatResultsData(results) {
  return results.map((r, i) => `${i + 1}. ${r.title} | ${r.date || "n.d."} | ${r.url}`).join("\n");
}

export function articleText(a) {
  if (!a) return "";
  const parts = [a.title, `${a.source}${a.date ? ` | ${a.date}` : ""}`];
  if (a.authors?.length) parts.push(`Authors: ${a.authors.join(", ")}`);
  parts.push("", a.abstract || a.snippet || "");
  parts.push("", `Source: ${a.url}`);
  return parts.join("\n").trim();
}

export function resultsText(set) {
  if (!set) return "";
  const head = `Search results for "${set.query}" (${set.source === "papers" ? "papers" : "web"})`;
  const body = set.results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.source} | ${r.date || "n.d."}\n   ${r.snippet}`)
    .join("\n");
  return [head, ...set.notes, "", body || "No results."].join("\n");
}

// ------------------------------------------------------------ internal URLs

export const searchUrl = (q, source = "web") =>
  `jarvis://search?q=${encodeURIComponent(q)}&source=${source}`;
export const articleUrl = (id) => `jarvis://article?id=${encodeURIComponent(id)}`;
export const isInternalUrl = (url) => /^jarvis:\/\//i.test(String(url || ""));

export function parseInternalUrl(url) {
  const m = String(url || "").match(/^jarvis:\/\/(search|article)\?(.*)$/i);
  if (!m) return null;
  const p = new URLSearchParams(m[2]);
  if (m[1].toLowerCase() === "search") {
    return {
      type: "search",
      q: p.get("q") || "",
      source: p.get("source") === "papers" ? "papers" : "web",
    };
  }
  return { type: "article", id: p.get("id") || "" };
}
