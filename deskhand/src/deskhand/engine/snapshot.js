// Builds the compact desktop description the planner works from, and owns the
// generic DOM scan that lets "click X" / "type Y" work in any app.
import useWindowsStore from "../../store/window.js";
import { dockApps } from "../../constants/dock.js";
import { collectSummaries, getHandlers, listRegisteredApps } from "../bridge.js";
import { MAX_ELEMENTS_PER_WINDOW, pickLabel, trimSnapshot } from "./snapshot-core.js";

const INTERACTIVE =
  'button, a, input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], [role="link"], [contenteditable=""], [contenteditable="true"]';

let counter = 0;
let clipboardText = "";
let clipboardTapped = false;

export const getInternalClipboard = () => clipboardText;
export const setInternalClipboard = (t) => {
  if (typeof t === "string" && t) clipboardText = t.slice(0, 2000);
};

/** Record what the page copies, since navigator.clipboard reads are permission-gated. */
export function installClipboardTap() {
  if (clipboardTapped || typeof window === "undefined") return;
  clipboardTapped = true;
  document.addEventListener("copy", () => {
    const sel = String(window.getSelection?.() ?? "");
    if (sel) setInternalClipboard(sel);
  });
  const cb = navigator.clipboard;
  if (cb?.writeText) {
    const orig = cb.writeText.bind(cb);
    try {
      cb.writeText = (t) => {
        setInternalClipboard(String(t));
        return orig(t);
      };
    } catch {
      /* read-only in some browsers */
    }
  }
}

export function windowElement(key) {
  return typeof document === "undefined" ? null : document.getElementById(key);
}

export function isRendered(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
}

export const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
};

/** Usable desktop area: below the menu bar, above the dock. */
export function getViewportArea() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const top = 35;
  let bottom = height - 8;
  const dock = document.querySelector(".dock-container");
  if (dock) {
    const r = dock.getBoundingClientRect();
    if (r.width > 0 && r.top > height / 2) bottom = Math.min(bottom, r.top - 10);
  }
  return { width, height, top, bottom, left: 0, areaWidth: width, areaHeight: Math.max(200, bottom - top) };
}

function titleOf(key, el) {
  const h = el?.querySelector("#window-header, .window-header");
  const t = h?.textContent?.replace(/\s+/g, " ").trim();
  return (t && t.length <= 60 ? t : dockApps.find((a) => a.id === key)?.name) || key;
}

function describe(el) {
  const tag = el.tagName.toLowerCase();
  const roleAttr = el.getAttribute("role");
  let role = roleAttr || tag;
  if (tag === "a") role = "link";
  else if (tag === "input") role = el.type === "checkbox" || el.type === "radio" ? el.type : el.type === "submit" ? "button" : "input";
  else if (el.isContentEditable) role = "editable";
  const iconTitle = el.querySelector("svg title")?.textContent || el.querySelector("img[alt]")?.getAttribute("alt");
  const label = pickLabel({
    ariaLabel: el.getAttribute("aria-label"),
    text: el.matches("input, textarea, select") ? "" : el.textContent,
    title: el.getAttribute("title") || iconTitle,
    placeholder: el.getAttribute("placeholder"),
    alt: el.getAttribute("alt"),
    name: el.getAttribute("name"),
  });
  let value = "";
  if (tag === "input" || tag === "textarea" || tag === "select") value = el.type === "password" ? "" : el.value;
  else if (el.isContentEditable) value = el.textContent;
  return { role, label, value };
}

/** Visible interactive elements of one open window, each tagged with data-dk-id. */
export function scanWindowElements(key) {
  const root = windowElement(key);
  if (!isRendered(root)) return [];
  const bounds = root.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = [];
  for (const el of root.querySelectorAll(INTERACTIVE)) {
    if (out.length >= MAX_ELEMENTS_PER_WINDOW) break;
    if (el.closest(".resize-handle") || el.classList.contains("resize-handle")) continue;
    if (el.disabled || el.getAttribute("aria-hidden") === "true" || el.type === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right < Math.max(0, bounds.left) || r.left > Math.min(vw, bounds.right)) continue;
    if (r.bottom < Math.max(0, bounds.top) || r.top > Math.min(vh, bounds.bottom)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.pointerEvents === "none") continue;
    const d = describe(el);
    if (!d.label && !d.value && d.role !== "input" && d.role !== "editable") continue;
    let id = el.getAttribute("data-dk-id");
    if (!id) {
      id = `dk-${++counter}`;
      el.setAttribute("data-dk-id", id);
    }
    out.push({ id, role: d.role, label: d.label, ...(d.value ? { value: d.value } : {}) });
  }
  return out;
}

/** Resolve a data-dk-id (or null) inside a window to a live element. */
export function elementById(key, id) {
  const root = windowElement(key);
  return root ? root.querySelector(`[data-dk-id="${CSS.escape(id)}"]`) : null;
}

/** Full compact snapshot (already trimmed). */
export function buildSnapshot({ withElements = true } = {}) {
  const st = useWindowsStore.getState();
  const area = getViewportArea();
  const windows = [];
  const elements = {};
  for (const [key, w] of Object.entries(st.windows)) {
    if (!w.isOpen) continue;
    const el = windowElement(key);
    windows.push({
      key,
      title: titleOf(key, el),
      z: w.zIndex,
      minimized: !!w.isMinimized,
      maximized: !!w.isMaximized,
      rect: el && isRendered(el) ? rectOf(el) : undefined,
    });
    if (withElements && !w.isMinimized) elements[key] = scanWindowElements(key);
  }
  const visible = windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z);
  const m = st.music;
  const settings = {};
  for (const [k, v] of Object.entries(st.systemSettings)) if (["boolean", "number"].includes(typeof v)) settings[k] = v;
  return trimSnapshot({
    viewport: { width: area.width, height: area.height, top: area.top, bottom: area.bottom },
    focused: visible[0]?.key ?? null,
    windows,
    music: { isPlaying: m.isPlaying, volume: m.volume, track: m.activeTrack?.title, artist: m.activeTrack?.artist },
    settings,
    clipboard: clipboardText,
    summaries: collectSummaries(),
    capabilities: listRegisteredApps().map((app) => ({ app, handlers: Object.keys(getHandlers(app) ?? {}) })),
    elements,
  });
}
