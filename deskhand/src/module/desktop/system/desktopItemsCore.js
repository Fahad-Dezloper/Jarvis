// Pure operations on desktop items and the Trash. Pure, no alias imports.
// An item: { id, kind:"folder"|"file"|"image", name, text?, src?, parent?, x?, y? }

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const stripExt = (s) => String(s ?? "").replace(/\.[a-z0-9]{1,5}$/i, "");

export const DEFAULT_TEXT_EXT = ".txt";

export function cleanName(name, fallback) {
  const n = String(name ?? "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return n || fallback;
}

export function textFileName(name) {
  const n = cleanName(name, "Untitled");
  return /\.[a-z0-9]{1,5}$/i.test(n) ? n : n + DEFAULT_TEXT_EXT;
}

/** "Trips" -> "Trips 2" when taken (case-insensitive), within the same parent. */
export function uniqueName(name, items, parent = null, ignoreId = null) {
  const taken = new Set(
    items.filter((i) => (i.parent ?? null) === parent && i.id !== ignoreId).map((i) => i.name.toLowerCase()),
  );
  if (!taken.has(name.toLowerCase())) return name;
  const m = name.match(/^(.*?)(\.[a-z0-9]{1,5})?$/i);
  const base = m[1];
  const ext = m[2] || "";
  for (let i = 2; i < 500; i++) {
    const cand = `${base} ${i}${ext}`;
    if (!taken.has(cand.toLowerCase())) return cand;
  }
  return `${base} ${Date.now()}${ext}`;
}

export function nextId(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Auto grid slot for the nth item without a stored position (column-major, left to right). */
export function autoPosition(index, viewport, o = {}) {
  const x0 = o.x0 ?? 150;
  const y0 = o.y0 ?? 60;
  const cell = o.cell ?? 96;
  const rows = Math.max(1, Math.floor((viewport.height - y0 - (o.bottom ?? 130)) / cell));
  return { x: x0 + Math.floor(index / rows) * cell, y: y0 + (index % rows) * cell };
}

function score(query, name) {
  const q = norm(query);
  const n = norm(name);
  const b = norm(stripExt(name));
  if (!q || !n) return 0;
  if (q === n || q === b) return 100;
  if (b.includes(q) || n.includes(q)) return 80;
  if (q.includes(b) && b.length >= 3) return 70;
  const qt = q.split(" ").filter((t) => t && !["the", "a", "my", "file", "folder", "called", "named"].includes(t));
  if (!qt.length) return 0;
  const nt = b.split(" ");
  return Math.round((qt.filter((t) => nt.includes(t)).length / qt.length) * 60);
}

/** Best item by name among `items` (objects with .name). Returns item or null. */
export function findByName(query, items, threshold = 55) {
  let best = null;
  let bestScore = 0;
  for (const it of items) {
    const s = score(query, it.name);
    if (s > bestScore) {
      best = it;
      bestScore = s;
    }
  }
  return bestScore >= threshold ? best : null;
}

/** Move an item (and its children) from `items` to `trash`. */
export function trashItem(items, trash, id, now = Date.now()) {
  const root = items.find((i) => i.id === id);
  if (!root) return { items, trash };
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const i of items) if (i.parent && ids.has(i.parent) && !ids.has(i.id)) (ids.add(i.id), (grew = true));
  }
  const moved = items.filter((i) => ids.has(i.id)).map((i) => ({ ...i, trashedAt: now, from: i.parent ?? null }));
  return { items: items.filter((i) => !ids.has(i.id)), trash: [...trash, ...moved] };
}

/** Put an item back on the desktop; returns the restored name. */
export function restoreItem(items, trash, id) {
  const it = trash.find((t) => t.id === id);
  if (!it) return { items, trash, restored: null };
  const { trashedAt: _a, from: _b, ...rest } = it;
  const parentOk = rest.parent && items.some((i) => i.id === rest.parent);
  const restored = { ...rest, parent: parentOk ? rest.parent : null, name: uniqueName(rest.name, items, parentOk ? rest.parent : null) };
  return { items: [...items, restored], trash: trash.filter((t) => t.id !== id), restored };
}

export function describeItems(items, parent = null) {
  const here = items.filter((i) => (i.parent ?? null) === parent);
  return here.map((i) => `${i.name}${i.kind === "folder" ? "/" : ""}`);
}
