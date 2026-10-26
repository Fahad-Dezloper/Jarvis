// The single 'browser' handler set. Chrome and Safari each register a controller
// here; the handlers act on the front-most one (Chrome wins ties). Registered at
// module load so the handlers exist even before a browser window is open: they
// open Chrome themselves when none is.
import useWindowsStore from "@store/window";
import "../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import { copyText } from "../safari/clipboard";
import {
  HN_URL,
  START_URL,
  findMockPage,
  isCurrentPageRef,
  pickLink,
  resolveTarget,
} from "../safari/data/pages";
import useBrowserStore, { loadPage, runSearch } from "./browserStore";
import {
  articleText,
  articleUrl,
  formatResultsData,
  isHttpUrl,
  normalizeSource,
  pageUrl,
  parseInternalUrl,
  resultsText,
  searchUrl,
  selectResult,
} from "./searchCore";

const controllers = new Map(); // window key -> () => controller
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_TEXT = 6000;
const OPEN_TEXT = 3000;
const HANDLER_TIMEOUT_MS = 12_000;
const PAGE_WAIT_MS = 10_000;
const isFileLike = (u) => /\.(pdf|zip|png|jpe?g|gif|mp4|mp3|dmg|exe)(\?|$)/i.test(String(u));

/** controller: { navigate(url), back(), tab() -> {title,url,historyIndex} } */
export function registerBrowserController(key, getController) {
  controllers.set(key, getController);
  return () => {
    if (controllers.get(key) === getController) controllers.delete(key);
  };
}

function frontKey() {
  const wins = useWindowsStore.getState().windows;
  const live = ["chrome", "safari"].filter(
    (k) => wins[k]?.isOpen && !wins[k]?.isMinimized && controllers.has(k),
  );
  if (!live.length) return null;
  if (live.length === 1) return live[0];
  return (wins.safari.zIndex || 0) > (wins.chrome.zIndex || 0) ? "safari" : "chrome";
}

async function ensureBrowser() {
  let key = frontKey();
  if (key) return controllers.get(key)();
  useWindowsStore.getState().openWindow("chrome");
  for (let i = 0; i < 60; i++) {
    await sleep(50);
    key = frontKey();
    if (key) {
      await sleep(80);
      return controllers.get(key)();
    }
  }
  return null;
}

const fail = (message) => ({ ok: false, message });
const guard = (fn) => async (args) => {
  let timer;
  try {
    return await Promise.race([
      fn(args || {}),
      new Promise((resolve) => {
        timer = setTimeout(
          () =>
            resolve(
              fail(`The browser took too long (over ${HANDLER_TIMEOUT_MS / 1000} seconds). Try again.`),
            ),
          HANDLER_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    return fail(`Browser error: ${err?.message || err}`);
  } finally {
    clearTimeout(timer);
  }
};

/** Wait for a reader page, but never longer than PAGE_WAIT_MS. Resolves to the entry or null. */
const waitPage = (url) => Promise.race([loadPage(url), sleep(PAGE_WAIT_MS).then(() => null)]);

/** jarvis://page?url=X -> X, anything else unchanged. */
const realUrl = (u) => {
  const p = parseInternalUrl(u);
  return p?.type === "page" ? p.url : u;
};

/** Header lines plus the page text, for HandlerResult.data. */
function readerText(d, max) {
  const head = [
    `Title: ${d.title}`,
    d.siteName ? `Source: ${d.siteName}` : "",
    d.byline ? `By: ${d.byline}` : "",
    d.date ? `Date: ${d.date}` : "",
    `URL: ${d.url}`,
  ].filter(Boolean);
  return `${head.join("\n")}\n\n${d.text || ""}`.slice(0, max);
}

function visibleLinks(ctl) {
  const out = [];
  try {
    document.querySelectorAll(`#${ctl.key} a[data-dk-url]`).forEach((a) => {
      const label = (a.textContent || a.getAttribute("title") || "").trim();
      if (label) out.push({ label, url: a.getAttribute("data-dk-url") });
    });
  } catch {
    /* no DOM */
  }
  return out;
}

function pageText(ctl) {
  const tab = ctl.tab();
  const p = parseInternalUrl(tab.url);
  let body;
  if (p?.type === "search") {
    body = resultsText(useBrowserStore.getState().getSearch(p.q, p.source));
  } else if (p?.type === "page") {
    const e = useBrowserStore.getState().getPage(p.url);
    if (e?.status === "ok") return readerText(e.data, MAX_TEXT);
    body = e?.status === "error" ? `This page could not be read: ${e.error?.message}` : "The page is still loading.";
  } else if (p?.type === "article") {
    body = articleText(useBrowserStore.getState().getArticle(p.id));
  } else {
    try {
      const el =
        document.querySelector(`#${ctl.key} [data-dk-content]`) || document.getElementById(ctl.key);
      body = (el?.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
    } catch {
      body = "";
    }
  }
  return `${tab.title} (${tab.url})\n\n${body}`.slice(0, MAX_TEXT);
}

const handlers = {
  search: guard(async ({ query, source }) => {
    const q = String(query ?? "").trim();
    if (!q) return fail("No search query was given.");
    const src = normalizeSource(source);
    const ctl = await ensureBrowser();
    if (!ctl) return fail("Could not open a browser window.");
    const set = await runSearch(q, src);
    ctl.navigate(searchUrl(set.query, src));
    const n = set.results.length;
    const label = src === "papers" ? "paper" : src === "news" ? "news" : "web";
    const via = set.provider ? ` via ${set.provider}` : "";
    const note = set.notes.length ? ` (${set.notes.join(" ")})` : "";
    if (!n)
      return {
        ok: true,
        message: `No ${label} results for "${set.query}"${via}.${note}`,
        data: "No results.",
      };
    return {
      ok: true,
      message: `Showing ${n} ${label} results for "${set.query}"${via}.${note}`,
      data: formatResultsData(set.results),
    };
  }),

  open_result: guard(async ({ which }) => {
    const set = useBrowserStore.getState().getCurrentSearch();
    if (!set || !set.results.length)
      return fail("There are no search results to open. Search first.");
    const hit = selectResult(set.results, which);
    if (!hit) return fail(`No result matches "${which}". There are ${set.results.length} results.`);
    const ctl = await ensureBrowser();
    if (!ctl) return fail("Could not open a browser window.");
    const r = hit.result;
    const num = hit.index + 1;
    const summaryOf = () =>
      [
        `Title: ${r.title}`,
        `Date: ${r.date || "n.d."}`,
        `Source: ${r.source}`,
        r.authors?.length ? `Authors: ${r.authors.join(", ")}` : "",
        `URL: ${r.url}`,
        "",
        r.abstract || r.snippet,
      ]
        .filter((x) => x !== "")
        .join("\n")
        .slice(0, MAX_TEXT);

    // Real web page: show it through the reader and hand back its text.
    if (!r.demo && isHttpUrl(r.url) && (r.kind === "web" || (r.kind === "research" && !r.abstract))) {
      const pending = loadPage(r.url);
      ctl.navigate(pageUrl(r.url));
      const entry = await Promise.race([pending, sleep(PAGE_WAIT_MS).then(() => null)]);
      if (entry?.status === "ok") {
        const d = entry.data;
        return {
          ok: true,
          message: `Opened result ${num}: ${d.title || r.title} (${d.siteName || r.source}).`,
          data: readerText(d, OPEN_TEXT),
        };
      }
      if (entry?.status === "error")
        return {
          ok: false,
          message: `Opened result ${num} (${r.title}) but could not read it: ${entry.error?.message} The original can be opened in a new tab.`,
          data: summaryOf(),
        };
      return {
        ok: true,
        message: `Opened result ${num}: ${r.title}. It is still loading.`,
        data: summaryOf(),
      };
    }

    // Curated entries (papers, Paradigm, offline sample) show their abstract page.
    ctl.navigate(articleUrl(r.id));
    return {
      ok: true,
      message: `Opened result ${num}: ${r.title} (${r.date || "n.d."}).`,
      data: summaryOf(),
    };
  }),

  read_page: guard(async () => {
    const ctl = await ensureBrowser();
    if (!ctl) return fail("No browser window is open.");
    const p = parseInternalUrl(ctl.tab().url);
    if (p?.type === "page") {
      const entry = await waitPage(p.url);
      if (entry?.status === "error")
        return fail(`This page could not be read: ${entry.error?.message}`);
      if (!entry) return fail("The page is still loading. Try again in a moment.");
    }
    const text = pageText(ctl);
    return { ok: true, message: `Read the page "${ctl.tab().title}".`, data: text };
  }),

  open_url: guard(async ({ url }) => {
    const target = String(url ?? "").trim();
    if (!target) return fail("No page or link was given.");
    const ctl = await ensureBrowser();
    if (!ctl) return fail("Could not open a browser window.");
    let hit = resolveTarget(target, visibleLinks(ctl));
    // A literal real address is never swapped for the invented Hacker News page.
    if (hit && hit.via === "url" && hit.url === HN_URL && isHttpUrl(target)) hit = null;
    const dest = hit ? hit.url : target;
    const mock = findMockPage(dest);
    if (mock || dest === START_URL || hit?.url.startsWith("safari://")) {
      ctl.navigate(dest);
      return {
        ok: true,
        message: `Opened ${mock ? mock.title : dest === START_URL ? "the start page" : dest}.`,
      };
    }
    // A real address (typed, or a link on the page): load it through the reader.
    let web = null;
    const asPage = parseInternalUrl(dest);
    if (asPage?.type === "page") web = asPage.url;
    else if (isHttpUrl(dest)) web = dest;
    else if (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/.test(dest)) web = `https://${dest}`;
    if (web) {
      if (isFileLike(web))
        return fail(`That link looks like a file, not a web page. Open ${web} in a new tab instead.`);
      const pending = loadPage(web);
      ctl.navigate(pageUrl(web));
      const entry = await Promise.race([pending, sleep(PAGE_WAIT_MS).then(() => null)]);
      if (entry?.status === "ok")
        return {
          ok: true,
          message: `Opened ${entry.data.title || web}.`,
          data: readerText(entry.data, OPEN_TEXT),
        };
      if (entry?.status === "error")
        return {
          ok: false,
          message: `Opened ${web} but could not read it: ${entry.error?.message} The original can be opened in a new tab.`,
        };
      return { ok: true, message: `Opened ${web}. It is still loading.` };
    }
    // Not an address: treat it as a search.
    const set = await runSearch(target, "web");
    ctl.navigate(searchUrl(set.query, "web"));
    return {
      ok: true,
      message: `"${target}" is not a web address, so I searched for it${set.provider ? ` via ${set.provider}` : ""}.`,
      data: formatResultsData(set.results),
    };
  }),

  copy_link: guard(async ({ element }) => {
    const ctl = await ensureBrowser();
    if (!ctl) return fail("No browser window is open.");
    const el = String(element ?? "").trim();
    const current = ctl.tab();
    let url = current.url;
    let label = current.title;
    const p = parseInternalUrl(current.url);
    if (p?.type === "article") url = useBrowserStore.getState().getArticle(p.id)?.url || url;
    if (p?.type === "page") url = p.url;
    if (p?.type === "search") return fail("A search results page has no shareable link.");
    if (el && !isCurrentPageRef(el)) {
      const link = pickLink(el, visibleLinks(ctl));
      if (link) {
        url = realUrl(link.url);
        label = link.label;
      } else if (pickLink(el, [{ label: current.title, url: current.url }], 30)) {
        /* current page */
      } else {
        const mock = resolveTarget(el, []);
        if (mock) url = mock.url;
        else return fail(`I could not find a link called "${el}" on this page.`);
      }
    }
    if (url === START_URL || url === "chrome://newtab")
      return fail("The start page has no shareable link.");
    const copied = await copyText(url);
    return {
      ok: true,
      message: copied
        ? `Copied ${url} to the clipboard.`
        : `Copied ${url} (held in the desktop clipboard; the system clipboard was blocked).`,
      data: url,
      url,
      label,
    };
  }),

  back: guard(async () => {
    const key = frontKey();
    if (!key) return fail("No browser window is open.");
    const ctl = controllers.get(key)();
    if (ctl.tab().historyIndex <= 0) return fail("There is no earlier page to go back to.");
    ctl.back();
    return { ok: true, message: "Went back one page." };
  }),
};

if (typeof window !== "undefined") {
  registerHandlers("browser", handlers);
  registerSummary("browser", () => {
    const key = frontKey();
    if (!key) return "No browser window is open (Chrome and Safari are available).";
    const ctl = controllers.get(key)();
    const tab = ctl.tab();
    const p = parseInternalUrl(tab.url);
    const name = key === "chrome" ? "Chrome" : "Safari";
    if (p?.type === "search") {
      const set = useBrowserStore.getState().getSearch(p.q, p.source);
      const list = (set?.results || [])
        .slice(0, 6)
        .map((r, i) => `${i + 1}. ${r.title} (${r.date || "n.d."})`)
        .join("; ");
      return `${name} is showing search results for "${p.q}" (${p.source}${set?.provider ? `, via ${set.provider}` : ""}): ${list || "none"}.`;
    }
    if (p?.type === "page") {
      const e = useBrowserStore.getState().getPage(p.url);
      const state = e?.status === "ok" ? "reader view" : e?.status === "error" ? "could not be read" : "loading";
      return `${name} is showing "${tab.title}" at ${p.url} (${state}).`;
    }
    return `${name} is showing "${tab.title}" at ${tab.url}. ${tab.historyIndex > 0 ? "Back is available." : "No earlier page."}`;
  });
}
