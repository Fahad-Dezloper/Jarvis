// Pure logic for the voice capture field. No DOM, no aliases: testable from node.

/** Wispr inserts the whole sentence at once after the key is released. */
export const QUIET_MS = 1300;
export const MIN_CHARS = 2;

/** Collapse whitespace and drop the stray trailing newline dictation tools add. */
export function cleanCommand(raw) {
  return String(raw ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCommittable(raw) {
  return cleanCommand(raw).replace(/\s/g, "").length >= MIN_CHARS;
}

/**
 * Decide what to do with the capture field right now.
 * @param {{value:string, changedAt:number|null, now:number, quietMs?:number, busy?:boolean, enter?:boolean}} input
 * @returns {{action:"none"|"wait"|"commit"|"discard"|"hold", text:string, waitMs:number}}
 *   none: nothing changed. wait: still arriving, check again in waitMs.
 *   commit: send `text`. discard: clear the field (whitespace or one stray char).
 *   hold: ready, but the engine is busy; try again when it is free.
 */
export function decideCommit({
  value,
  changedAt,
  now,
  quietMs = QUIET_MS,
  busy = false,
  enter = false,
}) {
  const text = cleanCommand(value);
  if (changedAt == null && !enter) return { action: "none", text: "", waitMs: 0 };
  const elapsed = changedAt == null ? quietMs : now - changedAt;
  const quiet = enter || elapsed >= quietMs;
  if (!quiet) return { action: "wait", text, waitMs: quietMs - elapsed };
  if (!isCommittable(value)) return { action: "discard", text: "", waitMs: 0 };
  if (busy) return { action: "hold", text, waitMs: 0 };
  return { action: "commit", text, waitMs: 0 };
}

const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "url",
  "email",
  "tel",
  "password",
  "number",
]);

/** Is this element a real place the user is typing (so we must not steal focus)? */
export function isRealEditable(el, captureEl = null) {
  if (!el || el === captureEl) return false;
  const tag = String(el.tagName || "").toUpperCase();
  if (el.disabled || el.readOnly) return false;
  if (el.isContentEditable) return true;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") return TEXT_INPUT_TYPES.has(String(el.type || "").toLowerCase());
  return false;
}

/** After a click or focus loss: should the capture field take focus back? */
export function shouldCaptureFocus(active, captureEl, { paused = false, force = false } = {}) {
  if (force) return true;
  if (paused) return false;
  return !isRealEditable(active, captureEl);
}
