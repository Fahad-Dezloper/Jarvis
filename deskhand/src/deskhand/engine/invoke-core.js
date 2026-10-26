// Pure helpers for the executor's invoke path (no DOM, no store), so they run
// under plain tsx in scripts/check-engine.mjs.
import { WINDOW_TO_GROUP } from "../capabilities.js";
import { isWindowless } from "./engine-capabilities.js";

export const FAST_INVOKE_TIMEOUT_MS = 8000;
export const SLOW_INVOKE_TIMEOUT_MS = 15_000;
/** How long to wait for a handler to register before giving up. */
export const HANDLER_WAIT_MS = 4000;
export const DATA_MAX_CHARS = 6000;

const SLOW_HANDLERS = new Set(["terminal.read_project", "terminal.run_command", "finder.read_file", "weather.show", "calendar.list_events"]);
// reading, searching and fetching handlers in any group (browser.search, browser.read_page, ...)
const SLOW_NAME = /^(?:search|read_|fetch|open_result|summari[sz]e|research|find_)/;

/** Reading/search handlers get 15s, everything else (including all desktop handlers) 8s. */
export function invokeTimeout(app, name) {
  if (app === "desktop") return FAST_INVOKE_TIMEOUT_MS;
  if (SLOW_HANDLERS.has(`${app}.${name}`) || SLOW_NAME.test(String(name))) return SLOW_INVOKE_TIMEOUT_MS;
  return FAST_INVOKE_TIMEOUT_MS;
}

/** The window keys that serve a capability group. */
export const windowsForGroup = (app) => Object.keys(WINDOW_TO_GROUP).filter((k) => WINDOW_TO_GROUP[k] === app);

/**
 * Precise failure text when no handler is registered for app.name.
 * @param {{app:string,name:string,groupRegistered:boolean,anyWindowOpen:boolean}} s
 */
export function handlerNotReadyMessage({ app, name, groupRegistered, anyWindowOpen }) {
  if (isWindowless(app)) return `The ${app} handler isn't ready${groupRegistered ? ` (it has no "${name}" action)` : " (the desktop has not registered it yet)"}.`;
  if (!anyWindowOpen) return `The ${app} handler isn't ready: its window is not open, so open ${windowsForGroup(app).join(" or ") || app} first.`;
  return `The ${app} handler isn't ready${groupRegistered ? ` (it has no "${name}" action)` : ""}.`;
}

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Render a window's element list as compact text lines for the planner. */
export function formatElements(windowKey, elements, { focused = false } = {}) {
  const list = Array.isArray(elements) ? elements : [];
  const head = `Window ${windowKey}${focused ? " (focused)" : ""}: ${list.length} clickable element${list.length === 1 ? "" : "s"}.`;
  if (!list.length) return `${head} Nothing clickable is visible; try another window or scroll.`;
  const lines = list.map((e) => `${clip(e.id, 24)} ${clip(e.role, 16)} "${clip(e.label, 80)}"${e.value ? ` value="${clip(e.value, 100)}"` : ""}`);
  let out = `${head}\n${lines.join("\n")}`;
  if (out.length > DATA_MAX_CHARS) out = `${out.slice(0, DATA_MAX_CHARS)}…`;
  return out;
}
