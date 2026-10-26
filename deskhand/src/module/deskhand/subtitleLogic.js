// Pure helpers for the subtitle pill. No DOM, no aliases.

export const REPLY_MS = 3500;
export const ERROR_MS = 6000;
export const MAX_REPLY_MS = 12000;

/** How long the final reply stays up: longer for longer sentences. */
export function resultDuration(text, isError = false) {
  const base = isError ? ERROR_MS : REPLY_MS;
  const extra = Math.max(0, String(text || "").length - 70) * 45;
  return Math.min(MAX_REPLY_MS, base + extra);
}

export function sourceBadge(source) {
  if (source === "model") return { text: "AI", cls: "dk-badge-ai" };
  if (source === "rules") return { text: "Offline", cls: "dk-badge-rules" };
  return null;
}

/**
 * Work out what the subtitle shows.
 * kinds: none | listening | live | running | reply | error
 */
export function deriveSubtitle({
  live = "",
  status = "idle",
  command = "",
  reply = "",
  error = "",
  cancelled = false,
  ok = true,
  source = null,
  showResult = false,
  listening = false,
}) {
  const liveText = String(live || "").trim();
  if (liveText) return { kind: "live", text: liveText, badge: null };
  if (status === "running") {
    return { kind: "running", text: String(command || "").trim(), badge: null, note: reply || "" };
  }
  if (showResult) {
    if (error) return { kind: "error", text: error, badge: null };
    if (cancelled) return { kind: "error", text: "Stopped.", badge: null };
    if (reply) return { kind: ok ? "reply" : "error", text: reply, badge: sourceBadge(source) };
  }
  if (listening) return { kind: "listening", text: "", badge: null };
  return { kind: "none", text: "", badge: null };
}

/** The log shows only while steps run, or when pinned and a plan exists. */
export function logVisible({ status, pinned, actionCount }) {
  if (!actionCount) return false;
  return status === "running" || !!pinned;
}
