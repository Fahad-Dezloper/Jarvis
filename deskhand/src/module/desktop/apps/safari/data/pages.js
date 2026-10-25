// Built-in pages that need no network, plus pure helpers to resolve a spoken
// target ("the poker artifact", "hacker news", a URL) to one of them.
// No framework or alias imports: this file is exercised by scripts/check-apps.mjs.

export const START_URL = "safari://start";
export const ARTIFACT_URL = "https://claude.ai/public/artifacts/poker-odds-9f2c";
export const HN_URL = "https://news.ycombinator.com/";
export const GITHUB_URL = "https://github.com/orbit-labs/orbit-todo";

export const STORIES = [
  {
    id: "story-1",
    title: "Show HN: Orbit Todo, a tiny local-first task app",
    url: GITHUB_URL,
    domain: "github.com/orbit-labs",
    points: 412,
    by: "nadiak",
    age: "3 hours ago",
    comments: 138,
  },
  {
    id: "story-2",
    title: "Why SQLite is the only database most apps need",
    url: "https://sqlite-notes.dev/one-database",
    domain: "sqlite-notes.dev",
    points: 377,
    by: "wal_mode",
    age: "5 hours ago",
    comments: 201,
  },
  {
    id: "story-3",
    title: "A gentle introduction to arena allocators",
    url: "https://blog.rustacean.dev/arena-allocators",
    domain: "blog.rustacean.dev",
    points: 290,
    by: "borrowck",
    age: "6 hours ago",
    comments: 64,
  },
  {
    id: "story-4",
    title: "Voice interfaces finally feel fast",
    url: "https://latency.fyi/voice-interfaces",
    domain: "latency.fyi",
    points: 251,
    by: "speakeasy",
    age: "7 hours ago",
    comments: 92,
  },
  {
    id: "story-5",
    title: "How we cut our CI time from 40 minutes to 6",
    url: "https://eng.shipyard.io/faster-ci",
    domain: "eng.shipyard.io",
    points: 233,
    by: "pipelinepat",
    age: "8 hours ago",
    comments: 77,
  },
  {
    id: "story-6",
    title: "The poker odds cheat sheet, explained",
    url: ARTIFACT_URL,
    domain: "claude.ai",
    points: 188,
    by: "tablecaptain",
    age: "9 hours ago",
    comments: 41,
  },
  {
    id: "story-7",
    title: "Postgres 17 performance deep dive",
    url: "https://pg-weekly.com/17-deep-dive",
    domain: "pg-weekly.com",
    points: 164,
    by: "vacuumfull",
    age: "11 hours ago",
    comments: 55,
  },
  {
    id: "story-8",
    title: "Ask HN: What are you building this weekend?",
    url: "https://news.ycombinator.com/item?id=41000001",
    domain: "news.ycombinator.com",
    points: 129,
    by: "weekendhacker",
    age: "12 hours ago",
    comments: 306,
  },
];

export const POKER_TABLE = [
  { hand: "A A", name: "Pocket aces", vsRandom: "85.2%", note: "Best starting hand" },
  { hand: "K K", name: "Pocket kings", vsRandom: "82.4%", note: "Only beaten by an ace on board" },
  { hand: "Q Q", name: "Pocket queens", vsRandom: "79.9%", note: "Strong, but wary of A or K" },
  { hand: "A K s", name: "Ace-king suited", vsRandom: "67.0%", note: "Best non-pair hand" },
  { hand: "J T s", name: "Jack-ten suited", vsRandom: "57.5%", note: "Plays well post-flop" },
  { hand: "7 2 o", name: "Seven-deuce offsuit", vsRandom: "34.6%", note: "Worst starting hand" },
];

export const POKER_DRAWS = [
  { draw: "Flush draw", outs: 9, flopToRiver: "35%", turnToRiver: "19.6%" },
  { draw: "Open-ended straight draw", outs: 8, flopToRiver: "31.5%", turnToRiver: "17.4%" },
  { draw: "Gutshot straight draw", outs: 4, flopToRiver: "16.5%", turnToRiver: "8.7%" },
  { draw: "Two overcards", outs: 6, flopToRiver: "24.1%", turnToRiver: "13.0%" },
];

/** Registered pages. `kind` selects the renderer. */
export const PAGES = [
  {
    id: "start",
    url: START_URL,
    title: "Start Page",
    aliases: ["start", "start page", "home", "homepage", "favorites", "new tab"],
    kind: "start",
  },
  {
    id: "poker-odds",
    url: ARTIFACT_URL,
    title: "Poker odds explained",
    aliases: ["poker", "poker odds", "artifact", "claude artifact", "odds", "poker artifact"],
    kind: "artifact",
  },
  {
    id: "hacker-news",
    url: HN_URL,
    title: "Hacker News",
    aliases: ["hacker news", "hn", "news", "ycombinator", "y combinator"],
    kind: "hn",
  },
  {
    id: "github",
    url: GITHUB_URL,
    title: "orbit-labs/orbit-todo",
    aliases: ["github", "repo", "repository", "orbit todo", "orbit-todo"],
    kind: "github",
  },
  ...STORIES.filter((s) => ![GITHUB_URL, ARTIFACT_URL].includes(s.url)).map((s) => ({
    id: s.id,
    url: s.url,
    title: s.title,
    aliases: [],
    kind: "article",
    story: s,
  })),
];

const canon = (url) => {
  const u = String(url || "").trim().toLowerCase();
  const noHash = u.split("#")[0];
  return noHash.replace(/\/+$/, "");
};

/** Find a built-in page by exact URL (ignoring case, hash and trailing slash). */
export function findMockPage(url) {
  const key = canon(url);
  if (!key) return null;
  return PAGES.find((p) => p.kind !== "start" && canon(p.url) === key) || null;
}

/** Find a built-in page by id. */
export function findPageById(id) {
  return PAGES.find((p) => p.id === String(id || "").trim().toLowerCase()) || null;
}

// ------------------------------------------------------------------ matching

const STOP = new Set(["the", "a", "an", "to", "link", "page", "open", "go", "on", "of", "this", "that", "my", "please", "url", "story", "stories", "article", "post"]);

export function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (s) => normalizeText(s).split(" ").filter((t) => t && !STOP.has(t));

/** 0..100 similarity between a spoken query and a label. */
export function scoreMatch(query, label) {
  const q = normalizeText(query);
  const l = normalizeText(label);
  if (!q || !l) return 0;
  if (q === l) return 100;
  if (l.includes(q) && q.length >= 3) return 85;
  if (q.includes(l) && l.length >= 3) return 75;
  const qt = tokens(query);
  const lt = tokens(label);
  if (!qt.length || !lt.length) return 0;
  const hit = qt.filter((t) => lt.some((x) => x === t || (t.length >= 4 && (x.startsWith(t) || t.startsWith(x))))).length;
  return Math.round((hit / qt.length) * 70);
}

/** Best link by label. `links` are { label, url }. */
export function pickLink(query, links, threshold = 40) {
  let best = null;
  let bestScore = 0;
  for (const link of links || []) {
    const score = scoreMatch(query, link.label);
    if (score > bestScore) {
      best = link;
      bestScore = score;
    }
  }
  return bestScore >= threshold ? best : null;
}

const CURRENT_WORDS = new Set(["", "this", "page", "this page", "current", "current page", "here", "the page", "url", "this url", "link", "this link"]);

export function isCurrentPageRef(element) {
  return CURRENT_WORDS.has(normalizeText(element));
}

/**
 * Resolve an open_url argument to a URL.
 * Order: page id or alias, exact URL of a built-in page, visible link label,
 * built-in page title. Returns { url, via } or null (caller then treats the
 * input as a raw URL or search).
 */
export function resolveTarget(query, links = []) {
  const raw = String(query || "").trim();
  if (!raw) return null;
  const q = normalizeText(raw);

  const byId = findPageById(raw);
  if (byId) return { url: byId.url, via: "id" };

  const exact = findMockPage(raw);
  if (exact) return { url: exact.url, via: "url" };

  if (/^https?:\/\//i.test(raw) || raw.startsWith("safari://")) return null;

  for (const p of PAGES) {
    if (p.aliases.some((a) => normalizeText(a) === q)) return { url: p.url, via: "alias" };
  }

  const link = pickLink(raw, links, 55);
  if (link) return { url: link.url, via: "link" };

  let best = null;
  let bestScore = 0;
  for (const p of PAGES) {
    for (const label of [p.title, ...p.aliases]) {
      const s = scoreMatch(raw, label);
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
  }
  if (best && bestScore >= 55) return { url: best.url, via: "title" };
  return null;
}
