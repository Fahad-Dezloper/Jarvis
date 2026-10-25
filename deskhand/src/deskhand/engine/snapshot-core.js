// Pure helpers for the snapshot: caps and trimming. No DOM, no store, no aliases,
// so they run under plain tsx in scripts/check-engine.mjs and on the server.

export const MAX_ELEMENTS_PER_WINDOW = 60;
export const MAX_WINDOWS = 30;
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

  const elements = {};
  if (s.elements && typeof s.elements === "object") {
    for (const [key, list] of Object.entries(s.elements).slice(0, MAX_WINDOWS)) {
      if (!Array.isArray(list)) continue;
      elements[clip(key, 30)] = list
        .filter((e) => e && typeof e.id === "string")
        .slice(0, MAX_ELEMENTS_PER_WINDOW)
        .map((e) => ({
          id: clip(e.id, 24),
          role: clip(e.role, 16),
          label: clip(e.label, MAX_LABEL),
          ...(e.value ? { value: clip(String(e.value), MAX_VALUE) } : {}),
        }));
    }
  }

  const summaries = {};
  if (s.summaries && typeof s.summaries === "object") {
    for (const [k, v] of Object.entries(s.summaries).slice(0, 12)) summaries[clip(k, 20)] = clip(String(v ?? ""), 400);
  }

  const capabilities = (Array.isArray(s.capabilities) ? s.capabilities : [])
    .slice(0, 12)
    .map((c) => ({
      app: clip(c?.app, 20),
      handlers: (Array.isArray(c?.handlers) ? c.handlers : []).slice(0, 20).map((h) => clip(h, 30)),
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
