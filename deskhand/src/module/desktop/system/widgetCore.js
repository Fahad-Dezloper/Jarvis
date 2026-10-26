// Widget kinds, name matching and position maths. Pure, no alias imports.

export const WIDGET_KINDS = [
  { type: "clock-calendar", label: "Time & Calendar", aliases: ["calendar", "date", "time and calendar", "clock and calendar", "agenda"], size: { width: 264, height: 310 } },
  { type: "clock", label: "Clock", aliases: ["digital clock", "time"], size: { width: 190, height: 130 } },
  { type: "analog-clock", label: "Analog Clock", aliases: ["analog", "analogue", "analogue clock", "watch"], size: { width: 200, height: 200 } },
  { type: "weather", label: "Weather", aliases: ["forecast", "temperature", "temp"], size: { width: 220, height: 170 } },
  { type: "battery", label: "Battery", aliases: ["power", "charge"], size: { width: 190, height: 130 } },
  { type: "notes", label: "Notes", aliases: ["note", "sticky", "sticky note", "sticky notes", "stickies", "memo", "post it"], size: { width: 400, height: 290 } },
  { type: "music", label: "Music", aliases: ["now playing", "player", "spotify", "song", "songs", "media"], size: { width: 220, height: 130 } },
];

export const ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right", "center"];

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\bwidgets?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function kindList() {
  return WIDGET_KINDS.map((k) => k.type).join(", ");
}

/** @returns {{ok:true, kind:object}|{ok:false, message:string}} */
export function resolveWidgetKind(query) {
  const q = norm(query);
  if (!q) return { ok: false, message: `Which widget? Valid kinds: ${kindList()}.` };
  const hit =
    WIDGET_KINDS.find((k) => k.type.replace(/-/g, " ") === q || norm(k.label) === q) ||
    WIDGET_KINDS.find((k) => k.aliases.includes(q)) ||
    WIDGET_KINDS.find((k) => q.split(" ").length > 1 && (q.includes(norm(k.label)) || k.aliases.some((a) => q.includes(a)))) ||
    WIDGET_KINDS.find((k) => k.aliases.includes(q.split(" ").pop()) || k.type === q.split(" ").pop());
  if (hit) return { ok: true, kind: hit };
  return { ok: false, message: `There is no "${query}" widget. Valid kinds: ${kindList()}.` };
}

/** Accepts "top left", "upper right", "bottom", "middle", ... */
export function normalizeAnchor(value) {
  const v = norm(value);
  if (!v) return null;
  if (/\b(center|centre|middle)\b/.test(v)) return "center";
  const top = /\b(top|upper)\b/.test(v);
  const bottom = /\b(bottom|lower)\b/.test(v);
  const left = /\bleft\b/.test(v);
  const right = /\bright\b/.test(v);
  if ((top && bottom) || (left && right)) return null;
  if (top || bottom || left || right) return `${bottom ? "bottom" : "top"}-${left ? "left" : "right"}`;
  return null;
}

/**
 * Lay widgets out by anchor. Widgets that share an anchor stack away from the
 * screen corner and start a new column when they run out of height.
 * @param {{type:string, anchor:string, width:number, height:number, custom?:{left:number,top:number}}[]} list
 * @param {{width:number,height:number}} viewport
 * @param {{top?:number,bottom?:number,side?:number,gap?:number}} [m]
 * @returns {Record<string,{left:number,top:number}>}
 */
export function layoutWidgets(list, viewport, m = {}) {
  const top = m.top ?? 48;
  const bottom = m.bottom ?? 112;
  const side = m.side ?? 28;
  const gap = m.gap ?? 16;
  const availH = Math.max(120, viewport.height - top - bottom);
  const out = {};
  const groups = {};
  for (const w of list) {
    if (w.custom && Number.isFinite(w.custom.left) && Number.isFinite(w.custom.top)) {
      out[w.type] = {
        left: Math.max(0, Math.min(w.custom.left, viewport.width - w.width)),
        top: Math.max(top - 8, Math.min(w.custom.top, viewport.height - w.height)),
      };
      continue;
    }
    (groups[w.anchor] ||= []).push(w);
  }
  for (const [anchor, items] of Object.entries(groups)) {
    if (anchor === "center") {
      const total = items.reduce((s, w) => s + w.width, 0) + gap * (items.length - 1);
      let x = (viewport.width - total) / 2;
      for (const w of items) {
        out[w.type] = { left: Math.round(x), top: Math.round(top + (availH - w.height) / 2) };
        x += w.width + gap;
      }
      continue;
    }
    const isTop = anchor.startsWith("top");
    const isLeft = anchor.endsWith("left");
    let colWidth = 0;
    let used = 0;
    let xOffset = 0;
    for (const w of items) {
      if (used > 0 && used + w.height > availH) {
        xOffset += colWidth + gap;
        colWidth = 0;
        used = 0;
      }
      colWidth = Math.max(colWidth, w.width);
      const y = isTop ? top + used : viewport.height - bottom - used - w.height;
      const x = isLeft ? side + xOffset : viewport.width - side - xOffset - w.width;
      out[w.type] = { left: Math.round(x), top: Math.round(y) };
      used += w.height + gap;
    }
  }
  return out;
}

export function describeAnchor(a) {
  return String(a || "top-right").replace("-", " ");
}
