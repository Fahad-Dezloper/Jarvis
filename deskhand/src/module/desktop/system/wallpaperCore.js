// Wallpaper catalogue and name matching. Pure, no alias imports.

const STOCK = [
  { id: "violet-waves", label: "Violet Waves", src: "/wallpapers/wallpaper.webp", color: "#3a1a8a", words: ["purple", "indigo", "violet", "default", "original", "macos", "monterey", "waves"] },
  { id: "autumn-fireside", label: "Autumn Fireside", src: "/wallpapers/wallpaper2.webp", color: "#d9733a", words: ["anime", "girl", "reading", "fireplace", "fire", "sunset", "autumn", "orange", "cozy", "illustration", "book"] },
  { id: "magenta-waves", label: "Magenta Waves", src: "/wallpapers/wallpaper3.webp", color: "#8a0a7a", words: ["pink", "magenta", "purple", "red", "waves", "fuchsia"] },
  { id: "deep-blue-glow", label: "Deep Blue Glow", src: "/wallpapers/wallpaper4.webp", color: "#101a3a", words: ["blue", "dark", "night", "glow", "light", "navy"] },
  { id: "purple-curves", label: "Purple Curves", src: "/wallpapers/wallpaper5.webp", color: "#1a0f24", words: ["purple", "curves", "abstract", "shapes", "blobs", "dark", "black", "neon", "outline"] },
  { id: "teal-waves", label: "Teal Waves", src: "/wallpapers/wallpaper6.webp", color: "#0b4a55", words: ["teal", "green", "blue", "aqua", "waves", "turquoise", "cyan"] },
];

const COLOURS = [
  { id: "sky-blue", label: "Sky Blue", file: "sky-blue.png", color: "#a7c1db" },
  { id: "midnight", label: "Midnight", file: "midnight.png", color: "#2e3440" },
  { id: "starlight", label: "Starlight", file: "starlight.png", color: "#ece5d6" },
  { id: "silver", label: "Silver", file: "silver.png", color: "#dbdde0" },
  { id: "space-gray", label: "Space Gray", file: "space-gray.png", color: "#6c6e72" },
  { id: "space-black", label: "Space Black", file: "space-black.png", color: "#1d1d1f" },
  { id: "white", label: "White", file: "white.png", color: "#f5f5f7" },
  { id: "graphite", label: "Graphite", file: "graphite.png", color: "#3a3a3c" },
  { id: "forest-green", label: "Forest Green", file: "forest-green.png", color: "#2f4a3d" },
  { id: "dusk-blue", label: "Dusk Blue", file: "dusk-blue.png", color: "#2a3b5c" },
].map((c) => ({ id: c.id, label: c.label, src: `/wallpapers/plain/${c.file}`, color: c.color, plain: true, words: [] }));

export const WALLPAPERS = [...STOCK.map((w) => ({ ...w, plain: false })), ...COLOURS];
export const DEFAULT_WALLPAPER_ID = WALLPAPERS[0].id;

// Everyday colour words -> plain wallpaper id. Longest phrase wins.
export const COLOUR_WORDS = {
  "sky blue": "sky-blue",
  "light blue": "sky-blue",
  "baby blue": "sky-blue",
  blue: "sky-blue",
  "dark blue": "dusk-blue",
  "navy blue": "dusk-blue",
  navy: "dusk-blue",
  "deep blue": "dusk-blue",
  night: "midnight",
  "midnight blue": "midnight",
  black: "space-black",
  "jet black": "space-black",
  dark: "space-black",
  charcoal: "graphite",
  "dark gray": "graphite",
  "dark grey": "graphite",
  gray: "space-gray",
  grey: "space-gray",
  "light gray": "silver",
  "light grey": "silver",
  metallic: "silver",
  white: "white",
  "off white": "starlight",
  cream: "starlight",
  beige: "starlight",
  gold: "starlight",
  champagne: "starlight",
  green: "forest-green",
  "dark green": "forest-green",
  "forest green": "forest-green",
  olive: "forest-green",
};

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const NOISE = new Set(["the", "a", "an", "my", "to", "wallpaper", "background", "desktop", "set", "change", "make", "it", "please", "one", "colour", "color", "plain", "solid", "of", "with", "image", "picture", "photo", "theme", "screen"]);

function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const WORD_NUMBERS = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/**
 * Resolve a spoken/typed request to a wallpaper.
 * @param {unknown} query
 * @param {string} currentId
 * @param {{rng?:()=>number, list?:typeof WALLPAPERS}} [opts]
 * @returns {{ok:true, wallpaper:object}|{ok:false, message:string}}
 */
export function resolveWallpaper(query, currentId, opts = {}) {
  const list = opts.list || WALLPAPERS;
  const rng = opts.rng || Math.random;
  const raw = norm(query);
  if (!raw) return { ok: false, message: "No wallpaper was named." };
  const idx = list.findIndex((w) => w.id === currentId);

  if (/^(next|forward)( one| wallpaper)?$/.test(raw)) return { ok: true, wallpaper: list[(idx + 1) % list.length] };
  if (/^(previous|prev|back|last|before)( one| wallpaper)?$/.test(raw))
    return { ok: true, wallpaper: list[(idx - 1 + list.length) % list.length] };
  if (/^(random|any|surprise me|something|anything|shuffle)( one| wallpaper)?$/.test(raw)) {
    const pool = list.filter((w) => w.id !== currentId);
    return { ok: true, wallpaper: pool[Math.floor(rng() * pool.length) % pool.length] };
  }

  // numbers: "3", "wallpaper 3", "number three"
  const numMatch = raw.match(/^(?:wallpaper |number |no |#)?(\d{1,2})$/);
  const wordNum = raw.split(" ").map((t) => WORD_NUMBERS[t]).find(Boolean);
  const n = numMatch ? Number(numMatch[1]) : /\b(number|wallpaper|option)\b/.test(raw) || raw.split(" ").length === 1 ? wordNum : undefined;
  if (n) {
    if (n >= 1 && n <= list.length) return { ok: true, wallpaper: list[n - 1] };
    return { ok: false, message: `There are ${list.length} wallpapers, numbered 1 to ${list.length}.` };
  }

  // exact name / id
  const exact = list.find((w) => norm(w.label) === raw || w.id === raw.replace(/ /g, "-"));
  if (exact) return { ok: true, wallpaper: exact };

  const tokens = raw.split(" ").filter((t) => !NOISE.has(t));
  const core = tokens.join(" ");
  if (!core) return { ok: false, message: "No wallpaper was named." };

  // names contained in the phrase ("the midnight one")
  const contained = list.filter((w) => core.includes(norm(w.label)));
  if (contained.length) {
    contained.sort((a, b) => norm(b.label).length - norm(a.label).length);
    return { ok: true, wallpaper: contained[0] };
  }

  // everyday colour words (longest phrase first)
  const phrases = Object.keys(COLOUR_WORDS).sort((a, b) => b.length - a.length);
  const phrase = phrases.find((p) => (" " + raw + " ").includes(" " + p + " "));
  const phraseToks = phrase ? phrase.split(" ") : [];
  const hasStockWord = tokens.some((t) => !phraseToks.includes(t) && STOCK.some((s) => s.words.includes(t) && !COLOUR_WORDS[t]));
  if (phrase && !hasStockWord) {
    const id = COLOUR_WORDS[phrase];
    return { ok: true, wallpaper: list.find((w) => w.id === id) };
  }

  // scored token match over label + keywords, tolerating small typos
  let best = null;
  let bestScore = 0;
  for (const w of list) {
    const labelToks = norm(w.label).split(" ");
    let score = 0;
    for (const t of tokens) {
      if (labelToks.includes(t)) score += 3;
      else if (w.words.includes(t)) score += 2;
      else if (t.length >= 4 && [...labelToks, ...w.words].some((x) => x.length >= 4 && lev(t, x) <= (t.length >= 7 ? 2 : 1))) score += 2;
    }
    if (score > bestScore) {
      best = w;
      bestScore = score;
    }
  }
  if (best && bestScore >= 2) return { ok: true, wallpaper: best };
  if (phrase) return { ok: true, wallpaper: list.find((w) => w.id === COLOUR_WORDS[phrase]) };
  return { ok: false, message: `I do not have a wallpaper called "${query}". Available: ${list.map((w) => w.label).join(", ")}.` };
}

export const wallpaperById = (id) => WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];
