// Named playlists and fuzzy matching for voice requests.
// Pure module (no framework or alias imports) so it can be tested from Node.

/**
 * `queries` are Jamendo query fragments tried in order until one returns
 * enough tracks. `synth` lists the three offline fallback tracks.
 * Chord numbers are semitone offsets from `root` (MIDI note); each chord is
 * [offset, quality] with quality "m7" or "maj7".
 */
export const PLAYLISTS = [
  {
    id: "hinv",
    name: "HiNV Music",
    blurb: "Chilled lofi and chillout beats",
    aliases: ["hi nv", "high nv", "hi envy", "hi n v", "hinv"],
    queries: ["tags=lofi", "tags=chillout"],
    coverColor: "from-indigo-500 to-fuchsia-500",
    coverText: "🌙",
    synth: [
      { name: "Midnight Static", root: 57, bpm: 68, chords: [[0, "m7"], [5, "maj7"], [3, "maj7"], [7, "m7"]], arp: [0, 2, 1, 3, 2, 1, 3, 2] },
      { name: "Paper Lanterns", root: 55, bpm: 74, chords: [[0, "maj7"], [9, "m7"], [5, "maj7"], [7, "m7"]], arp: [0, 1, 2, 3, 2, 1, 2, 3] },
      { name: "Rainy Window", root: 52, bpm: 64, chords: [[0, "m7"], [8, "maj7"], [3, "maj7"], [10, "maj7"]], arp: [3, 2, 1, 0, 1, 2, 3, 2] },
    ],
  },
  {
    id: "night-drive",
    name: "Night Drive",
    blurb: "Synthwave for the late road",
    aliases: ["night drive", "nightdrive", "drive"],
    queries: ["tags=synthwave", "tags=electronic"],
    coverColor: "from-blue-700 to-pink-500",
    coverText: "🚗",
    synth: [
      { name: "Neon Overpass", root: 45, bpm: 84, chords: [[0, "m7"], [8, "maj7"], [3, "maj7"], [10, "maj7"]], arp: [0, 1, 2, 1, 3, 2, 1, 2] },
      { name: "Tail Lights", root: 50, bpm: 78, chords: [[0, "m7"], [3, "maj7"], [7, "m7"], [5, "maj7"]], arp: [0, 2, 3, 2, 1, 3, 2, 1] },
      { name: "Empty Highway", root: 48, bpm: 90, chords: [[0, "maj7"], [7, "m7"], [9, "m7"], [5, "maj7"]], arp: [1, 2, 3, 2, 0, 2, 3, 2] },
    ],
  },
  {
    id: "focus",
    name: "Focus",
    blurb: "Calm ambient for deep work",
    aliases: ["focus", "deep work", "concentration", "study"],
    queries: ["tags=ambient", "tags=instrumental"],
    coverColor: "from-emerald-500 to-teal-700",
    coverText: "🎧",
    synth: [
      { name: "Quiet Hours", root: 53, bpm: 58, chords: [[0, "maj7"], [7, "m7"], [5, "maj7"], [2, "m7"]], arp: [0, 3, 1, 3, 2, 3, 1, 3] },
      { name: "Soft Focus", root: 57, bpm: 60, chords: [[0, "m7"], [3, "maj7"], [5, "maj7"], [10, "maj7"]], arp: [0, 1, 3, 1, 2, 1, 3, 1] },
      { name: "Long Exposure", root: 50, bpm: 56, chords: [[0, "maj7"], [4, "m7"], [9, "m7"], [7, "m7"]], arp: [2, 1, 0, 1, 3, 2, 1, 2] },
    ],
  },
];

const FILLER = new Set([
  "the", "a", "an", "my", "play", "playlist", "playlists", "music", "song", "songs", "track", "tracks",
  "some", "please", "on", "from", "called", "named", "put", "start", "listen", "to",
]);

/** Lowercase, drop filler words, remove all spaces and punctuation. */
export function compact(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join("");
}

/** Returns { playlist, score } or null. */
export function matchPlaylist(query, playlists = PLAYLISTS) {
  const q = compact(query);
  if (!q) return null;
  let best = null;
  for (const pl of playlists) {
    const names = [pl.name, ...(pl.aliases || [])].map(compact).filter(Boolean);
    let score = 0;
    for (const n of names) {
      if (q === n) score = Math.max(score, 100);
      else if (q.length >= 3 && n.includes(q)) score = Math.max(score, 80);
      else if (n.length >= 3 && q.includes(n)) score = Math.max(score, 70);
    }
    if (score && (!best || score > best.score)) best = { playlist: pl, score };
  }
  return best;
}

/** Best track by title (equal or substring), among tracks with a `title`. */
export function matchTrack(query, tracks) {
  const q = compact(query);
  if (!q || q.length < 3) return null;
  let best = null;
  for (const t of tracks || []) {
    const n = compact(t.title);
    if (!n) continue;
    let score = 0;
    if (q === n) score = 100;
    else if (n.includes(q)) score = 80;
    else if (q.includes(n) && n.length >= 4) score = 70;
    if (score && (!best || score > best.score)) best = { track: t, score };
  }
  return best;
}

export const clampVolume = (level) => {
  const n = Number(level);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
};
