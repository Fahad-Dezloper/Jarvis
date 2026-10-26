import { useEffect, useRef, useState } from "react";
import useWindowsStore from "@store/window";
import { registerBrowserController } from "../browserHandlers";
import { titleForInternalUrl } from "../browserStore";
import { findMockPage, resolveTarget } from "../../safari/data/pages";
import { isInternalUrl, searchUrl } from "../searchCore";

export const NEWTAB = "chrome://newtab";

const makeTab = (url = NEWTAB, id = `tab-${Date.now()}-${Math.floor(Math.random() * 1e4)}`) => ({
  id,
  url,
  title: titleFor(url),
  history: [url],
  historyIndex: 0,
});

export function titleFor(url) {
  if (url === NEWTAB) return "New Tab";
  const internal = titleForInternalUrl(url);
  if (internal) return internal;
  const mock = findMockPage(url);
  if (mock) return mock.title;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Typed text or a URL -> destination URL. */
export function resolveInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (isInternalUrl(raw) || raw === NEWTAB) return raw;
  const hit = resolveTarget(raw);
  if (hit && hit.url !== "safari://start") return hit.url;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(raw)) return `https://${raw}`;
  return searchUrl(raw, "web");
}

export default function useChrome() {
  const [tabs, setTabs] = useState(() => [makeTab(NEWTAB, "tab-1")]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const isOpen = useWindowsStore((s) => s.windows.chrome?.isOpen);
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    if (!isOpen) {
      setTabs([makeTab(NEWTAB, "tab-1")]);
      setActiveTabId("tab-1");
    }
  }, [isOpen]);

  const navigate = (input) => {
    const url = resolveInput(input);
    if (!url) return;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const history = t.history.slice(0, t.historyIndex + 1);
        if (history[history.length - 1] !== url) history.push(url);
        return { ...t, url, title: titleFor(url), history, historyIndex: history.length - 1 };
      }),
    );
  };

  const go = (delta) =>
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const i = t.historyIndex + delta;
        if (i < 0 || i >= t.history.length) return t;
        const url = t.history[i];
        return { ...t, url, title: titleFor(url), historyIndex: i };
      }),
    );

  const newTab = () => {
    const t = makeTab();
    setTabs((prev) => (prev.length >= 10 ? prev : [...prev, t]));
    setActiveTabId(t.id);
  };

  const closeTab = (id, e) => {
    e?.stopPropagation();
    if (tabs.length === 1) {
      setTabs([makeTab(NEWTAB, "tab-1")]);
      setActiveTabId("tab-1");
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (activeTabId === id) setActiveTabId(next[Math.max(0, idx - 1)].id);
  };

  // Keep titles fresh once article data lands in the store.
  const live = useRef({});
  useEffect(() => {
    live.current = { activeTab, navigate, back: () => go(-1) };
  });
  useEffect(
    () =>
      registerBrowserController("chrome", () => ({
        key: "chrome",
        navigate: (u) => live.current.navigate(u),
        back: () => live.current.back(),
        tab: () => live.current.activeTab,
      })),
    [],
  );

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    navigate,
    back: () => go(-1),
    forward: () => go(1),
    newTab,
    closeTab,
  };
}
