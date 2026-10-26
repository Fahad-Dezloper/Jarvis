// Pure helpers for the snapshot: caps and trimming. No DOM, no store, no aliases,
// so they run under plain tsx in scripts/check-engine.mjs and on the server.

export const MAX_ELEMENTS_PER_WINDOW = 60;
export const MAX_WINDOWS = 30;
/** Elements kept for the other windows; the focused window keeps up to MAX_ELEMENTS_PER_WINDOW. */
export const MAX_ELEMENTS_OTHER_WINDOW = 30;
export const MAX_ELEMENTS_TOTAL = 240;
/** Windowless summaries (desktop) can be ~1500 chars; give each room and cap the sum. */
export const MAX_SUMMARY_CHARS = 1800;
export const MAX_SUMMARIES_TOTAL = 6000;
const MAX_LABEL = 80;
const MAX_VALUE = 120;

const clip = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d);

function trimRect(r) {
  if (!r || typeof r !== "object") return undefined;
  return { x: num(r.x), y: num(r.y), width: num(r.width), height: num(r.height) };
}

/** Normalise and cap an untrusted snapshot (the server never trusts the client's sizes). */
export function trimSnapshot(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const windows = (Array.isArray(s.windows) ? s.windows : [])
    .filter((w) => w && typeof w.key === "string")
    .slice(0, MAX_WINDOWS)
    .map((w) => ({
      key: clip(w.key, 30),
      title: clip(w.title, 60),
      z: num(w.z),
      minimized: !!w.minimized,
      maximized: !!w.maximized,
      rect: trimRect(w.rect),
    }));

  // Elements: the focused window first (full list), then the rest by recency, within a total budget.
  const zOf = (k) => windows.find((w) => w.key === k)?.z ?? 0;
  const topWindow = [...windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.key ?? null;
  const focusedKey = typeof s.focused === "string" && s.focused ? clip(s.focused, 30) : topWindow;
  const elements = {};
  if (s.elements && typeof s.elements === "object") {
    const entries = Object.entries(s.elements)
      .slice(0, MAX_WINDOWS)
      .map(([key, list]) => [clip(key, 30), list])
      .filter(([, list]) => Array.isArray(list))
      .sort((a, b) => (a[0] === focusedKey ? -1 : b[0] === focusedKey ? 1 : zOf(b[0]) - zOf(a[0])));
    let budget = MAX_ELEMENTS_TOTAL;
    for (const [key, list] of entries) {
      const cap = Math.min(budget, key === focusedKey ? MAX_ELEMENTS_PER_WINDOW : MAX_ELEMENTS_OTHER_WINDOW);
      const kept = list
        .filter((e) => e && typeof e.id === "string")
        .slice(0, cap)
        .map((e) => ({
          id: clip(e.id, 24),
          role: clip(e.role, 16),
          label: clip(e.label, MAX_LABEL),
          ...(e.value ? { value: clip(String(e.value), MAX_VALUE) } : {}),
        }));
      budget -= kept.length;
      elements[key] = kept;
    }
  }

  // Summaries: windowless groups (desktop) first so trimming never drops them.
  const summaries = {};
  if (s.summaries && typeof s.summaries === "object") {
    let room = MAX_SUMMARIES_TOTAL;
    const ordered = Object.entries(s.summaries)
      .slice(0, 24)
      .sort((a, b) => (a[0] === "desktop" ? -1 : b[0] === "desktop" ? 1 : 0));
    for (const [k, v] of ordered) {
      if (room <= 0) break;
      const text = clip(String(v ?? ""), Math.min(MAX_SUMMARY_CHARS, room));
      room -= text.length;
      summaries[clip(k, 20)] = text;
    }
  }

  const capabilities = (Array.isArray(s.capabilities) ? s.capabilities : [])
    .slice(0, 24)
    .map((c) => ({
      app: clip(c?.app, 20),
      handlers: (Array.isArray(c?.handlers) ? c.handlers : []).slice(0, 48).map((h) => clip(h, 30)),
    }));

  const music = s.music && typeof s.music === "object" ? s.music : {};
  const settings = {};
  if (s.settings && typeof s.settings === "object") {
    for (const [k, v] of Object.entries(s.settings).slice(0, 30)) {
      if (["boolean", "number"].includes(typeof v)) settings[clip(k, 30)] = v;
    }
  }

  const vp = s.viewport && typeof s.viewport === "object" ? s.viewport : {};
  return {
    viewport: {
      width: num(vp.width, 1440),
      height: num(vp.height, 900),
      top: num(vp.top, 35),
      bottom: num(vp.bottom, 810),
    },
    focused: typeof s.focused === "string" ? clip(s.focused, 30) : null,
    windows,
    music: {
      isPlaying: !!music.isPlaying,
      volume: num(music.volume, 0),
      track: clip(music.track, 100),
      artist: clip(music.artist, 60),
    },
    settings,
    clipboard: clip(s.clipboard, 300),
    summaries,
    capabilities,
    elements,
  };
}

/** Pick the best label for an element descriptor {ariaLabel,title,text,placeholder,alt}. */
export function pickLabel(d) {
  return clip(d.ariaLabel || d.text || d.title || d.placeholder || d.alt || d.name || "", MAX_LABEL);
}

/** Fuzzy score of a spoken target against an element label (0 = no match). */
export function labelScore(target, label) {
  const t = String(target || "").toLowerCase().trim();
  const l = String(label || "").toLowerCase().trim();
  if (!t || !l) return 0;
  if (t === l) return 100;
  if (l.startsWith(t)) return 80;
  if (l.includes(t)) return 70;
  if (t.includes(l) && l.length >= 3) return 55;
  const tw = t.split(/\W+/).filter(Boolean);
  const lw = new Set(l.split(/\W+/).filter(Boolean));
  if (!tw.length) return 0;
  const hit = tw.filter((w) => lw.has(w)).length;
  return hit ? Math.round((hit / tw.length) * 50) : 0;
}

/** Best match among [{id,label,...}] for a target string or a dk-id. */
export function bestElement(target, list) {
  const t = String(target || "").trim();
  const byId = list.find((e) => e.id === t);
  if (byId) return byId;
  let best = null;
  let bestScore = 0;
  for (const e of list) {
    const sc = labelScore(t, e.label);
    if (sc > bestScore) {
      best = e;
      bestScore = sc;
    }
  }
  return bestScore >= 25 ? best : null;
}
