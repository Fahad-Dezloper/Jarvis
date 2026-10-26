// The single 'browser' handler set. Chrome and Safari each register a controller
// here; the handlers act on the front-most one (Chrome wins ties). Registered at
// module load so the handlers exist even before a browser window is open: they
// open Chrome themselves when none is.
import useWindowsStore from "@store/window";
import "../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import { copyText } from "../safari/clipboard";
import {
  START_URL,
  findMockPage,
  isCurrentPageRef,
  pickLink,
  resolveTarget,
} from "../safari/data/pages";
import useBrowserStore, { runSearch } from "./browserStore";
import {
  articleText,
  articleUrl,
  formatResultsData,
  parseInternalUrl,
  resultsText,
  searchUrl,
  selectResult,
} from "./searchCore";

const controllers = new Map(); // window key -> () => controller
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_TEXT = 6000;

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
  try {
    return await fn(args || {});
  } catch (err) {
    return fail(`Browser error: ${err?.message || err}`);
  }
};

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
    const src = /paper|research|arxiv|scholar|study|studies/i.test(String(source ?? ""))
      ? "papers"
      : "web";
    const ctl = await ensureBrowser();
    if (!ctl) return fail("Could not open a browser window.");
    const set = await runSearch(q, src);
    ctl.navigate(searchUrl(set.query, src));
    const n = set.results.length;
    const note = set.notes.length ? ` (${set.notes.join(" ")})` : "";
    if (!n)
      return {
        ok: true,
        message: `No results for "${set.query}" in ${src === "papers" ? "papers" : "the demo web index"}.${note}`,
        data: "No results.",
      };
    return {
      ok: true,
      message: `Showing ${n} ${src === "papers" ? "paper" : "web"} results for "${set.query}".${note}`,
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
    ctl.navigate(articleUrl(r.id));
    const text = [
      `Title: ${r.title}`,
      `Date: ${r.date || "n.d."}`,
      `Source: ${r.source}`,
      r.authors?.length ? `Authors: ${r.authors.join(", ")}` : "",
      `URL: ${r.url}`,
      "",
      r.abstract || r.snippet,
    ]
      .filter((x) => x !== "")
      .join("\n");
    return {
      ok: true,
      message: `Opened result ${hit.index + 1}: ${r.title} (${r.date || "n.d."}).`,
      data: text.slice(0, MAX_TEXT),
    };
  }),

  read_page: guard(async () => {
    const ctl = await ensureBrowser();
    if (!ctl) return fail("No browser window is open.");
    const text = pageText(ctl);
    return { ok: true, message: `Read the page "${ctl.tab().title}".`, data: text };
  }),

  open_url: guard(async ({ url }) => {
    const target = String(url ?? "").trim();
    if (!target) return fail("No page or link was given.");
    const ctl = await ensureBrowser();
    if (!ctl) return fail("Could not open a browser window.");
    const hit = resolveTarget(target, visibleLinks(ctl));
    const dest = hit ? hit.url : target;
    ctl.navigate(dest);
    const mock = findMockPage(dest);
    const what = mock ? mock.title : dest === START_URL ? "the start page" : dest;
    return { ok: true, message: `Opened ${what}.` };
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
    if (el && !isCurrentPageRef(el)) {
      const link = pickLink(el, visibleLinks(ctl));
      if (link) {
        url = link.url;
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
        .map((r, i) => `${i + 1}. ${r.title} (${r.date})`)
        .join("; ");
      return `${name} is showing search results for "${p.q}" (${p.source}): ${list || "none"}.`;
    }
    return `${name} is showing "${tab.title}" at ${tab.url}. ${tab.historyIndex > 0 ? "Back is available." : "No earlier page."}`;
  });
}
