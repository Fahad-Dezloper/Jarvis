// Pure, DOM-free helpers used by the playback engine.
//
// The in-iframe runtime (runtime.source.ts) is a plain-JS string and cannot
// import this module, so it carries hand-written copies of these functions.
// scripts/check-runtime.ts evaluates the runtime source and compares its copies
// against these implementations, so the two cannot drift silently.

/** Escape a string for use as a CSS identifier (same algorithm as CSS.escape). */
export function cssEscapeIdent(value: string): string {
  const s = String(value);
  const first = s.charCodeAt(0);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ch = s.charAt(i);
    if (c === 0) {
      out += "�";
    } else if (
      (c >= 1 && c <= 0x1f) ||
      c === 0x7f ||
      (i === 0 && c >= 0x30 && c <= 0x39) ||
      (i === 1 && c >= 0x30 && c <= 0x39 && first === 0x2d)
    ) {
      out += "\\" + c.toString(16) + " ";
    } else if (i === 0 && s.length === 1 && c === 0x2d) {
      out += "\\" + ch;
    } else if (
      c >= 0x80 ||
      c === 0x2d ||
      c === 0x5f ||
      (c >= 0x30 && c <= 0x39) ||
      (c >= 0x41 && c <= 0x5a) ||
      (c >= 0x61 && c <= 0x7a)
    ) {
      out += ch;
    } else {
      out += "\\" + ch;
    }
  }
  return out;
}

/** Heuristic: class names produced by CSS-in-JS / CSS modules are not stable. */
export function isStableClass(name: string): boolean {
  if (!name) return false;
  if (name.indexOf("mb-") === 0) return false;
  if (/^(css|sc|jsx|emotion|svelte|astro)-/i.test(name)) return false;
  if (name.charAt(0) === "_") return false;
  if (/(?:__|--)[A-Za-z0-9_-]*\d[A-Za-z0-9_-]*$/.test(name)) return false;
  return true;
}

/** Heuristic: generated ids (React useId, long numeric runs) are not stable. */
export function isStableId(id: string): boolean {
  if (!id) return false;
  if (id.charAt(0) === ":") return false;
  if (/^\d/.test(id)) return false;
  if (/\d{4,}/.test(id)) return false;
  if (/^(radix|headlessui|react-aria)/i.test(id)) return false;
  return true;
}

/** Minimal element description used for selector generation. */
export interface SelNode {
  tag: string;
  id: string | null;
  classes: string[];
  /** 1-based index among siblings with the same tag. */
  nth: number;
  /** Number of siblings (including itself) with the same tag. */
  sameTag: number;
  parent: SelNode | null;
}

function segment(n: SelNode, withNth: boolean): { text: string; abs: boolean } {
  if (n.id && isStableId(n.id)) {
    return { text: "#" + cssEscapeIdent(n.id), abs: true };
  }
  let text = n.tag;
  const stable = n.classes.filter(isStableClass).slice(0, 2);
  for (let i = 0; i < stable.length; i++) text += "." + cssEscapeIdent(stable[i]);
  if (withNth && n.sameTag > 1) text += ":nth-of-type(" + n.nth + ")";
  return { text, abs: false };
}

/**
 * Build a short, stable CSS selector for `node`. Prefers a stable id, then
 * tag+classes, adding ancestors (joined with ">") until `isUnique` accepts it,
 * and falling back to :nth-of-type positions.
 */
export function generateSelector(
  node: SelNode,
  isUnique: (selector: string) => boolean,
): string {
  const levels: SelNode[] = [];
  let n: SelNode | null = node;
  while (n) {
    levels.push(n);
    if ((n.id && isStableId(n.id)) || n.tag === "body" || n.tag === "html") break;
    n = n.parent;
  }
  let last = "";
  for (let pass = 0; pass < 2; pass++) {
    const withNth = pass === 1;
    for (let k = 1; k <= levels.length; k++) {
      const parts: string[] = [];
      let abs = false;
      for (let i = k - 1; i >= 0; i--) {
        const s = segment(levels[i], withNth);
        parts.push(s.text);
        if (i === k - 1 && s.abs) abs = true;
      }
      last = parts.join(" > ");
      if (isUnique(last)) return last;
      if (abs) return last;
    }
  }
  return last;
}

export interface TimedItem {
  /** Offset from the start of the scene to the start of the delay phase. */
  startMs?: number;
  durationMs: number;
  delayMs: number;
  endDelayMs?: number;
  iterations: number;
}

/** End time of one item; infinite iteration counts are capped at one iteration. */
export function itemEndMs(item: TimedItem): { endMs: number; capped: boolean } {
  const dur = isFinite(item.durationMs) && item.durationMs > 0 ? item.durationMs : 0;
  const delay = isFinite(item.delayMs) ? item.delayMs : 0;
  const endDelay = item.endDelayMs && isFinite(item.endDelayMs) ? item.endDelayMs : 0;
  const start = item.startMs && isFinite(item.startMs) ? item.startMs : 0;
  const iters = item.iterations;
  const capped = !(typeof iters === "number" && isFinite(iters));
  const count = capped ? 1 : Math.max(0, iters);
  return { endMs: start + delay + dur * count + endDelay, capped };
}

/**
 * Scene length: the maximum end time over all items, with infinite items
 * counted as a single iteration. `cappedCount` says how many were capped.
 */
export function computeTotalMs(items: TimedItem[]): { totalMs: number; cappedCount: number } {
  let totalMs = 0;
  let cappedCount = 0;
  for (let i = 0; i < items.length; i++) {
    const r = itemEndMs(items[i]);
    if (r.capped) cappedCount++;
    if (r.endMs > totalMs) totalMs = r.endMs;
  }
  return { totalMs, cappedCount };
}

/** "backgroundColor" -> "background-color", "cssFloat" -> "float". */
export function toKebab(name: string): string {
  if (name === "cssFloat") return "float";
  if (name.indexOf("--") === 0) return name;
  return name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

const KEYFRAME_META = ["offset", "computedOffset", "easing", "composite"];

/** Ordered, de-duplicated list of animated CSS properties from getKeyframes(). */
export function summarizeKeyframes(keyframes: Array<Record<string, unknown>>): string[] {
  const seen: string[] = [];
  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    if (!kf) continue;
    for (const key in kf) {
      if (KEYFRAME_META.indexOf(key) !== -1) continue;
      const name = toKebab(key);
      if (seen.indexOf(name) === -1) seen.push(name);
    }
  }
  return seen;
}

const GSAP_RESERVED = [
  "duration", "delay", "ease", "repeat", "repeatDelay", "yoyo", "yoyoEase",
  "stagger", "overwrite", "paused", "immediateRender", "lazy", "data", "id",
  "keyframes", "css", "runBackwards", "startAt", "inherit", "defaults",
  "reversed", "repeatRefresh", "scrollTrigger", "motionPath", "callbackScope",
  "parent", "autoRevert", "from", "to", "preserveAlpha",
];

/** Animated property names from a GSAP tween `vars` object. */
export function gsapAnimatedProps(vars: Record<string, unknown> | null | undefined): string[] {
  const out: string[] = [];
  if (!vars) return out;
  const add = (k: string) => {
    if (out.indexOf(k) === -1) out.push(k);
  };
  for (const key in vars) {
    if (GSAP_RESERVED.indexOf(key) !== -1) continue;
    if (/^on[A-Z]/.test(key)) continue;
    add(key);
  }
  const css = vars.css;
  if (css && typeof css === "object") {
    for (const key in css as Record<string, unknown>) add(key);
  }
  return out;
}

/** Parse an SMIL clock value ("2s", "500ms", "00:05", "indefinite") to ms. */
export function parseClockValue(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (s === "indefinite") return Infinity;
  let m = /^(-?\d+(?:\.\d+)?|-?\.\d+)(h|min|s|ms)?$/.exec(s);
  if (m) {
    const v = parseFloat(m[1]);
    const unit = m[2] || "s";
    if (unit === "h") return v * 3600000;
    if (unit === "min") return v * 60000;
    if (unit === "ms") return v;
    return v * 1000;
  }
  m = /^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(s);
  if (m) {
    const h = m[1] ? parseInt(m[1], 10) : 0;
    return (h * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])) * 1000;
  }
  return null;
}

/** First offset-style value of an SMIL `begin` list; event-based begins count as 0. */
export function parseSmilBegin(input: string | null | undefined): number {
  if (!input) return 0;
  const first = String(input).split(";")[0];
  const v = parseClockValue(first);
  return v == null || !isFinite(v) ? 0 : v;
}

/** Short human label, e.g. "opacity, transform on .logo". */
export function buildLabel(props: string[], target: string | null, infinite: boolean): string {
  const what = props.length ? props.join(", ") : "animation";
  const base = target ? what + " on " + target : what;
  return infinite ? base + " (infinite, shown as 1 iteration)" : base;
}

/** Make script text safe to embed inside an inline <script> element. */
export function escapeScriptText(source: string): string {
  return source.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}
