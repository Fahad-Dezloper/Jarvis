// Clipboard helper shared by the browser handlers and the engine.
// The last copied text is also kept in module memory so a paste step still
// works when the system clipboard is blocked (permissions, insecure origin).

let lastCopied = "";

export function getLastCopied() {
  return lastCopied;
}

export function setLastCopied(text) {
  lastCopied = String(text ?? "");
}

/** Copies text; never throws. Resolves true when the system clipboard accepted it. */
export async function copyText(text) {
  const value = String(text ?? "");
  lastCopied = value;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
