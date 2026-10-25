// Find a file or folder by spoken name in the Finder location tree.
// Pure, no imports.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripExt = (s) => String(s || "").replace(/\.[a-z0-9]{1,5}$/i, "");

const FILLER = new Set(["the", "a", "my", "open", "folder", "file", "please", "in", "finder"]);

function score(query, name) {
  const q = norm(query);
  const n = norm(name);
  const nBase = norm(stripExt(name));
  if (!q || !n) return 0;
  if (q === n || q === nBase) return 100;
  if (nBase.includes(q) || n.includes(q)) return 80;
  if (q.includes(nBase) && nBase.length >= 3) return 70;
  const qt = q.split(" ").filter((t) => t && !FILLER.has(t));
  if (!qt.length) return 0;
  const nt = nBase.split(" ");
  const hit = qt.filter((t) => nt.includes(t)).length;
  return Math.round((hit / qt.length) * 60);
}

/** Depth-first search over `roots` ({ name, children? }). Returns the best item or null. */
export function findFinderItem(query, roots, threshold = 55) {
  let best = null;
  let bestScore = 0;
  const walk = (items, depth) => {
    for (const item of items || []) {
      const s = score(query, item.name) - depth; // prefer shallower on ties
      if (s > bestScore) {
        best = item;
        bestScore = s;
      }
      if (item.children) walk(item.children, depth + 0.1);
    }
  };
  walk(roots, 0);
  return bestScore >= threshold ? best : null;
}
