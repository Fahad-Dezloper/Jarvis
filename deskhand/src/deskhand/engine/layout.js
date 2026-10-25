// Pure geometry for tiling and clamping. Rects are {left, top, width, height}
// in viewport pixels. `area` is the usable desktop: below the menu bar and
// above the dock.

export const MIN_W = 300;
export const MIN_H = 200;
const GAP = 8;

/** Cells for n windows. */
export function computeTiles(n, layout, area) {
  if (n <= 0) return [];
  const a = { left: area.left + GAP, top: area.top + GAP, width: area.width - GAP * 2, height: area.height - GAP * 2 };
  const cells = [];
  if (layout === "columns") {
    const w = (a.width - GAP * (n - 1)) / n;
    for (let i = 0; i < n; i++) cells.push({ left: a.left + i * (w + GAP), top: a.top, width: w, height: a.height });
  } else if (layout === "rows") {
    const h = (a.height - GAP * (n - 1)) / n;
    for (let i = 0; i < n; i++) cells.push({ left: a.left, top: a.top + i * (h + GAP), width: a.width, height: h });
  } else if (layout === "cascade") {
    const step = 40;
    const w = Math.max(MIN_W, Math.min(a.width - step * (n - 1), a.width * 0.62));
    const h = Math.max(MIN_H, Math.min(a.height - step * (n - 1), a.height * 0.72));
    for (let i = 0; i < n; i++) cells.push({ left: a.left + i * step, top: a.top + i * step, width: w, height: h });
  } else {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const h = (a.height - GAP * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      const inRow = Math.min(cols, n - r * cols);
      const w = (a.width - GAP * (inRow - 1)) / inRow;
      for (let c = 0; c < inRow; c++) cells.push({ left: a.left + c * (w + GAP), top: a.top + r * (h + GAP), width: w, height: h });
    }
  }
  return cells.map((c) => ({
    left: Math.round(c.left),
    top: Math.round(c.top),
    width: Math.round(Math.max(MIN_W, c.width)),
    height: Math.round(Math.max(MIN_H, c.height)),
  }));
}

/** Keep a rect inside the area (shrinking only if it cannot fit at all). */
export function clampRect(r, area) {
  const width = Math.min(Math.max(MIN_W, r.width), area.width);
  const height = Math.min(Math.max(MIN_H, r.height), area.height);
  const left = Math.min(Math.max(area.left, r.left), area.left + area.width - width);
  const top = Math.min(Math.max(area.top, r.top), area.top + area.height - height);
  return { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) };
}
