// Small pure helpers for the system handlers. Pure, no alias imports.

export const clampLevel = (v, fallback = null) => {
  const n = typeof v === "string" ? parseFloat(v.replace("%", "")) : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
};

/** Show-desktop toggle. `saved` is the list of keys minimised by a previous call (or null). */
export function planShowDesktop(windows, saved) {
  if (saved && saved.length) {
    const restore = saved.filter((k) => windows[k]?.isOpen && windows[k]?.isMinimized);
    return { action: "restore", keys: restore };
  }
  const keys = Object.keys(windows).filter((k) => windows[k]?.isOpen && !windows[k]?.isMinimized && k !== "launchpad");
  return { action: "minimize", keys };
}

// Natural names -> dock app ids.
const DOCK_ALIASES = {
  spotify: "music",
  "apple music": "music",
  songs: "music",
  itunes: "music",
  "visual studio code": "vscode",
  "vs code": "vscode",
  code: "vscode",
  editor: "vscode",
  "code editor": "vscode",
  "google chrome": "chrome",
  browser: "safari",
  web: "safari",
  internet: "safari",
  "email": "mail",
  gmail: "mail",
  mails: "mail",
  gallery: "photos",
  pictures: "photos",
  images: "photos",
  "system settings": "settings",
  "system preferences": "settings",
  preferences: "settings",
  prefs: "settings",
  console: "terminal",
  shell: "terminal",
  "command line": "terminal",
  note: "notes",
  "notes pad": "notes",
  clock: "calendar",
  maths: "calculator",
  math: "calculator",
  forecast: "weather",
  files: "finder",
  "launch pad": "launchpad",
  bin: "trash",
  recycle: "trash",
};

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\b(app|application|the|icon|to|from|dock)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** @param {{id:string,name:string}[]} apps */
export function resolveDockApp(query, apps) {
  const q = norm(query);
  if (!q) return null;
  if (DOCK_ALIASES[q]) return apps.find((a) => a.id === DOCK_ALIASES[q]) || null;
  return (
    apps.find((a) => a.id === q || norm(a.name) === q) ||
    apps.find((a) => (q.length >= 3 && norm(a.name).includes(q)) || (" " + q + " ").includes(" " + norm(a.name) + " ")) ||
    null
  );
}

export const UNREMOVABLE_DOCK = ["finder", "trash"];

/** Insert before the "folder" separator when present, so apps stay left of Folder and Trash. */
export function dockInsert(ids, id) {
  if (ids.includes(id)) return ids;
  const at = ids.indexOf("folder");
  const next = [...ids];
  next.splice(at === -1 ? ids.length : at, 0, id);
  return next;
}

/** Rank spotlight candidates. items: {name, desc?, kind}. Higher kind priority first on ties. */
export function rankMatches(query, items, limit = 8) {
  const q = String(query ?? "").toLowerCase().trim();
  if (!q) return [];
  const scored = [];
  for (const it of items) {
    const n = it.name.toLowerCase();
    const d = String(it.desc ?? "").toLowerCase();
    let s = 0;
    if (n === q) s = 100;
    else if (n.startsWith(q)) s = 85;
    else if (n.includes(q)) s = 70;
    else if (d.includes(q)) s = 40;
    else {
      const toks = q.split(/\s+/).filter(Boolean);
      const hit = toks.filter((t) => n.includes(t) || d.includes(t)).length;
      if (hit && hit === toks.length) s = 50;
    }
    if (s) scored.push({ it, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.it);
}
