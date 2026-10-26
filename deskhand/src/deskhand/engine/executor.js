// Performs validated Actions on the live desktop. Every step resolves to
// {ok, message}; nothing here throws. Windows are moved through the same GSAP
// x/y transform that Draggable uses, so manual drags keep working afterwards.
import gsap from "gsap";
import useWindowsStore from "../../store/window.js";
import { getHandlers } from "../bridge.js";
import { WINDOW_TO_GROUP } from "../capabilities.js";
import { CLIPBOARD_TOKEN } from "./schema.js";
import { clampRect, computeTiles } from "./layout.js";
import { bestElement } from "./snapshot-core.js";
import {
  elementById,
  getInternalClipboard,
  getViewportArea,
  isRendered,
  rectOf,
  scanWindowElements,
  setInternalClipboard,
  windowElement,
} from "./snapshot.js";

const store = () => useWindowsStore.getState();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (message) => ({ ok: true, message });
const fail = (message) => ({ ok: false, message });
const MOVE_SECONDS = 0.5;
const INVOKE_TIMEOUT_MS = 5000;
const DATA_MAX_CHARS = 6000;
/** Slower handlers (searching, reading, fetching) get longer than the 5s default. */
const SLOW_INVOKE_TIMEOUT_MS = 15_000;
const SLOW_HANDLERS = new Set([
  "browser.search",
  "browser.open_result",
  "browser.read_page",
  "terminal.read_project",
  "terminal.run_command",
  "finder.read_file",
  "weather.show",
  "calendar.list_events",
]);
export const invokeTimeout = (app, name) => (SLOW_HANDLERS.has(`${app}.${name}`) ? SLOW_INVOKE_TIMEOUT_MS : INVOKE_TIMEOUT_MS);

const areaRect = () => {
  const a = getViewportArea();
  return { left: 0, top: a.top, width: a.width, height: Math.max(200, a.bottom - a.top) };
};

async function waitFor(cond, ms = 2500, every = 60) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(every);
  }
  return cond();
}

const winState = (key) => store().windows[key];

// ---------- window geometry ----------

function unmaximize(key) {
  if (winState(key)?.isMaximized) store().toggleMaximize(key);
}

/** Animate a window's box to a viewport rect, via the GSAP x/y transform. */
function setBox(el, box, { animate = true } = {}) {
  return new Promise((resolve) => {
    const r = el.getBoundingClientRect();
    const x = (Number(gsap.getProperty(el, "x")) || 0) + (box.left - r.left);
    const y = (Number(gsap.getProperty(el, "y")) || 0) + (box.top - r.top);
    el.style.maxWidth = "none";
    el.style.maxHeight = "none";
    const vars = { x, y, duration: animate ? MOVE_SECONDS : 0, ease: "power2.inOut", overwrite: "auto", onComplete: resolve };
    if (box.width != null) vars.width = box.width;
    if (box.height != null) vars.height = box.height;
    gsap.to(el, vars);
    setTimeout(resolve, (animate ? MOVE_SECONDS : 0) * 1000 + 400);
  });
}

async function ensureVisible(key) {
  const w = winState(key);
  if (!w?.isOpen) return null;
  if (w.isMinimized) store().unminimizeWindow(key);
  await waitFor(() => isRendered(windowElement(key)), 2000);
  const el = windowElement(key);
  if (!isRendered(el)) return null;
  // let the open/restore animation settle so the rect is real
  await waitFor(() => Number(gsap.getProperty(el, "scale")) > 0.98 && gsap.getTweensOf(el).length === 0, 1200);
  return el;
}

async function doMove(key, x, y) {
  const el = await ensureVisible(key);
  if (!el) return fail(`${key} is not open`);
  unmaximize(key);
  await sleep(50);
  const r = el.getBoundingClientRect();
  const c = clampRect({ left: x, top: y, width: r.width, height: r.height }, areaRect());
  await setBox(el, { left: c.left, top: c.top });
  return ok(`Moved ${key}`);
}

async function doResize(key, width, height) {
  const el = await ensureVisible(key);
  if (!el) return fail(`${key} is not open`);
  unmaximize(key);
  await sleep(50);
  const r = el.getBoundingClientRect();
  const c = clampRect({ left: r.left, top: r.top, width, height }, areaRect());
  await setBox(el, { left: c.left, top: c.top, width: c.width, height: c.height });
  return ok(`Resized ${key} to ${c.width}x${c.height}`);
}

async function doTile(layout, keys) {
  const open = Object.entries(store().windows)
    .filter(([, w]) => w.isOpen && !w.isMinimized)
    .sort((a, b) => a[1].zIndex - b[1].zIndex)
    .map(([k]) => k);
  const list = (keys?.length ? keys.filter((k) => winState(k)?.isOpen) : open).filter((k) => isRendered(windowElement(k)) || winState(k)?.isMinimized);
  if (!list.length) return fail("No windows to arrange");
  const els = [];
  for (const k of list) {
    const el = await ensureVisible(k);
    if (el) {
      unmaximize(k);
      els.push([k, el]);
    }
  }
  await sleep(60);
  const cells = computeTiles(els.length, layout, areaRect());
  await Promise.all(els.map(([, el], i) => setBox(el, cells[i])));
  els.forEach(([k]) => store().focusWindow(k));
  return ok(`Arranged ${els.length} window${els.length === 1 ? "" : "s"} (${layout})`);
}

// ---------- element interaction ----------

function resolveElement(windowKey, target) {
  const root = windowElement(windowKey);
  if (!isRendered(root)) return null;
  if (/^dk-\d+$/.test(target ?? "")) {
    const el = elementById(windowKey, target);
    if (el) return el;
  }
  const list = scanWindowElements(windowKey);
  const hit = bestElement(target, list);
  return hit ? elementById(windowKey, hit.id) : null;
}

function firstEditable(windowKey) {
  const root = windowElement(windowKey);
  if (!root) return null;
  const active = document.activeElement;
  if (active && root.contains(active) && active.matches?.('input, textarea, [contenteditable=""], [contenteditable="true"]')) return active;
  for (const el of root.querySelectorAll('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), [contenteditable=""], [contenteditable="true"]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) return el;
  }
  return null;
}

function fireClick(el) {
  const r = el.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, view: window };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true }));
  el.dispatchEvent(new MouseEvent("mousedown", init));
  el.focus?.({ preventScroll: true });
  el.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true }));
  el.dispatchEvent(new MouseEvent("mouseup", init));
  el.dispatchEvent(new MouseEvent("click", init));
}

function insertText(el, text) {
  el.focus?.({ preventScroll: true });
  if (el.isContentEditable) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    if (!document.execCommand?.("insertText", false, text)) {
      el.textContent = (el.textContent ?? "") + text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
    return;
  }
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const next = el instanceof HTMLTextAreaElement ? (el.value ? `${el.value}${text}` : text) : text;
  setter ? setter.call(el, next) : (el.value = next);
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function pressEnter(el) {
  const init = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
  const down = el.dispatchEvent(new KeyboardEvent("keydown", init));
  el.dispatchEvent(new KeyboardEvent("keypress", init));
  el.dispatchEvent(new KeyboardEvent("keyup", init));
  const form = el.closest?.("form");
  if (down && form && el.tagName !== "TEXTAREA") form.requestSubmit?.();
}

// ---------- bridge ----------

async function readClipboard() {
  const internal = getInternalClipboard();
  if (internal) return internal;
  try {
    return await Promise.race([navigator.clipboard.readText(), sleep(600).then(() => "")]);
  } catch {
    return "";
  }
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
}

/** Direct store fallbacks for capabilities whose app window is not mounted. */
function storeFallback(app, name, args) {
  const s = store();
  if (app === "settings" && name === "set_theme") {
    s.updateSystemSetting("darkMode", args.theme === "dark");
    return ok(`Switched to ${args.theme} mode`);
  }
  if (app === "settings" && name === "set_setting") {
    s.updateSystemSetting(args.key, !!args.value);
    return ok(`${args.key} ${args.value ? "on" : "off"}`);
  }
  if (app === "music" && name === "set_volume") {
    s.setMusicState({ volume: args.level, isMuted: args.level === 0 });
    return ok(`Volume ${args.level}`);
  }
  if (app === "music" && name === "pause") {
    s.setMusicState({ isPlaying: false });
    return ok("Paused");
  }
  return null;
}

async function doInvoke(action) {
  const { app, name } = action;
  const args = { ...(action.args ?? {}) };
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" && v.includes(CLIPBOARD_TOKEN)) {
      const clip = await readClipboard();
      if (!clip) return fail("The clipboard is empty, so there is nothing to paste");
      args[k] = v.split(CLIPBOARD_TOKEN).join(clip);
    }
  }
  const appeared = await waitFor(() => getHandlers(app)?.[name], 4000, 100);
  const fn = getHandlers(app)?.[name];
  if (!appeared || typeof fn !== "function") {
    const fb = storeFallback(app, name, args);
    if (fb) return fb;
    return fail(`The ${app} app is not ready for "${name}"`);
  }
  try {
    const limit = invokeTimeout(app, name);
    const res = await withTimeout(Promise.resolve(fn(args)), limit);
    const out = { ok: !!res?.ok, message: String(res?.message ?? (res?.ok ? "Done" : "Failed")) };
    if (typeof res?.data === "string" && res.data) out.data = res.data.length > DATA_MAX_CHARS ? `${res.data.slice(0, DATA_MAX_CHARS)}\u2026` : res.data;
    if (out.ok && app === "browser" && name === "copy_link") {
      const url = /https?:\/\/\S+/.exec(out.message)?.[0];
      if (url) setInternalClipboard(url);
    }
    return out;
  } catch (e) {
    return fail(e?.message === "timed out" ? `${app}.${name} took longer than ${Math.round(invokeTimeout(app, name) / 1000)} seconds` : `${app}.${name} failed`);
  }
}

// ---------- public API ----------

/** Bounding box a step is about to act on (for the virtual cursor), or undefined. */
export function targetRect(action) {
  try {
    if (action.type === "click") {
      const el = resolveElement(action.window, action.target);
      if (el) return rectOf(el);
    }
    if (action.type === "type") {
      const el = action.target ? resolveElement(action.window, action.target) : firstEditable(action.window);
      if (el) return rectOf(el);
    }
    let key = action.window;
    if (action.type === "invoke") key = Object.keys(WINDOW_TO_GROUP).find((k) => WINDOW_TO_GROUP[k] === action.app && winState(k)?.isOpen);
    if (action.type === "tile") key = action.windows?.[0] ?? Object.keys(store().windows).find((k) => winState(k)?.isOpen);
    const el = key ? windowElement(key) : null;
    if (el && isRendered(el)) return rectOf(el);
  } catch {
    /* rect is cosmetic */
  }
  return undefined;
}

/** @returns {Promise<{ok:boolean,message:string,data?:string}>} */
export async function executeAction(action) {
  try {
    const s = store();
    switch (action.type) {
      case "open": {
        s.openWindow(action.window);
        const shown = await waitFor(() => isRendered(windowElement(action.window)), 2500);
        if (shown) await waitFor(() => gsap.getTweensOf(windowElement(action.window)).length === 0, 1200);
        return shown ? ok(`Opened ${action.window}`) : fail(`${action.window} did not appear`);
      }
      case "close":
        if (!winState(action.window)?.isOpen) return ok(`${action.window} was already closed`);
        s.closeWindow(action.window);
        return ok(`Closed ${action.window}`);
      case "minimize":
        if (!winState(action.window)?.isOpen) return fail(`${action.window} is not open`);
        s.minimizeWindow(action.window);
        return ok(`Minimized ${action.window}`);
      case "maximize": {
        const w = winState(action.window);
        if (!w?.isOpen) return fail(`${action.window} is not open`);
        if (w.isMinimized) s.unminimizeWindow(action.window);
        if (!winState(action.window).isMaximized) s.toggleMaximize(action.window);
        s.focusWindow(action.window);
        return ok(`Maximized ${action.window}`);
      }
      case "restore": {
        const w = winState(action.window);
        if (!w?.isOpen) return fail(`${action.window} is not open`);
        if (w.isMinimized) s.unminimizeWindow(action.window);
        else if (w.isMaximized) s.toggleMaximize(action.window);
        s.focusWindow(action.window);
        return ok(`Restored ${action.window}`);
      }
      case "focus": {
        const w = winState(action.window);
        if (!w?.isOpen) return fail(`${action.window} is not open`);
        if (w.isMinimized) s.unminimizeWindow(action.window);
        else s.focusWindow(action.window);
        return ok(`Focused ${action.window}`);
      }
      case "move":
        return await doMove(action.window, action.x, action.y);
      case "resize":
        return await doResize(action.window, action.width, action.height);
      case "tile":
        return await doTile(action.layout, action.windows);
      case "click": {
        if (!winState(action.window)?.isOpen) return fail(`${action.window} is not open`);
        s.focusWindow(action.window);
        await ensureVisible(action.window);
        const el = resolveElement(action.window, action.target);
        if (!el) return fail(`Could not find "${action.target}" in ${action.window}`);
        el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        fireClick(el);
        return ok(`Clicked "${action.target}"`);
      }
      case "type": {
        if (!winState(action.window)?.isOpen) return fail(`${action.window} is not open`);
        s.focusWindow(action.window);
        await ensureVisible(action.window);
        const el = action.target ? resolveElement(action.window, action.target) : firstEditable(action.window);
        if (!el) return fail(`No text field found in ${action.window}`);
        insertText(el, action.text);
        if (action.submit) pressEnter(el);
        return ok(`Typed into ${action.window}${action.submit ? " and pressed Enter" : ""}`);
      }
      case "invoke":
        return await doInvoke(action);
      case "say":
        return ok(action.text);
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    return fail(`Step failed: ${e?.message ?? "unknown error"}`);
  }
}
