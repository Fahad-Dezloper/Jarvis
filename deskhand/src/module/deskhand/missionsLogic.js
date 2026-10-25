// Pure mission-ticking logic. Inputs are plain snapshots, outputs are plain objects.

export const MISSIONS = [
  { id: 1, label: "Open Claude Code", hint: "open Claude Code" },
  { id: 2, label: "Run npm run dev", hint: "run npm run dev" },
  { id: 3, label: "Close it", hint: "close it" },
  { id: 4, label: "Open Spotify (music)", hint: "open Spotify" },
  { id: 5, label: "Play the HiNV Music playlist", hint: "play the HiNV Music playlist" },
];

export const BONUS = [
  {
    id: "b1",
    label: "Open the browser and save this artifact link to my notes",
    hint: "open the browser and save this artifact link to my notes",
  },
  {
    id: "b2",
    label: "Resize the windows so they all look good",
    hint: "resize the windows so they all look good",
  },
  { id: "b3", label: "Switch to dark mode", hint: "switch to dark mode" },
];

export function initialProgress() {
  return { done: {}, flags: {} };
}

export function countDone(progress, list = MISSIONS) {
  return list.filter((m) => progress.done[m.id]).length;
}

export function isComplete(progress) {
  return countDone(progress, MISSIONS) === MISSIONS.length;
}

const HINV = /hi\s*-?\s*nv/i;

/** Does the music store state say the HiNV playlist is playing? */
export function isHinvPlaying(music) {
  if (!music || !music.isPlaying) return false;
  const t = music.activeTrack || {};
  const fields = [
    music.playlist,
    music.playlistName,
    music.activePlaylist,
    t.playlist,
    t.playlistName,
    t.album,
    t.artist,
    t.title,
  ];
  return fields.some((f) => typeof f === "string" && HINV.test(f));
}

/** Reduce a store snapshot to the few fields the missions care about. */
export function snapshotStore(state) {
  const w = (state && state.windows) || {};
  return {
    terminalOpen: !!(w.terminal && w.terminal.isOpen),
    musicOpen: !!(w.music && w.music.isOpen),
    music: state && state.music,
    darkMode: state && state.systemSettings ? !!state.systemSettings.darkMode : undefined,
  };
}

function mark(next, id) {
  if (next.done[id]) return false;
  next.done = { ...next.done, [id]: true };
  return true;
}

function setFlag(next, key, value) {
  if (next.flags[key] === value) return false;
  next.flags = { ...next.flags, [key]: value };
  return true;
}

/**
 * @param {{done:Object,flags:Object}} progress
 * @param {{store?:ReturnType<typeof snapshotStore>, event?:any}} input
 * @returns the same object when nothing changed
 */
export function tickMissions(progress, input = {}) {
  const next = { done: progress.done, flags: progress.flags };
  let changed = false;
  const { store, event } = input;

  if (store) {
    if (store.terminalOpen) {
      changed = setFlag(next, "terminalOpened", true) || changed;
      changed = mark(next, 1) || changed;
    } else if (next.flags.terminalOpened && next.done[1]) {
      changed = mark(next, 3) || changed;
    }
    if (store.musicOpen) changed = mark(next, 4) || changed;
    const playing = !!(store.music && store.music.isPlaying);
    changed = setFlag(next, "musicPlaying", playing) || changed;
    if (isHinvPlaying(store.music) || (playing && next.flags.hinvRequested)) {
      changed = mark(next, 5) || changed;
    }
    if (typeof store.darkMode === "boolean") {
      if (next.flags.dark === false && store.darkMode === true)
        changed = mark(next, "b3") || changed;
      changed = setFlag(next, "dark", store.darkMode) || changed;
    }
  }

  if (event && event.type === "step" && event.status === "ok" && event.action) {
    const a = event.action;
    const args = (a.args && typeof a.args === "object" ? a.args : {}) || {};
    if (a.type === "invoke") {
      if (a.app === "terminal" && a.name === "run_command") {
        if (/npm\s+run\s+dev/i.test(String(args.command || ""))) changed = mark(next, 2) || changed;
      }
      if (a.app === "music" && a.name === "play" && HINV.test(String(args.query || ""))) {
        changed = setFlag(next, "hinvRequested", true) || changed;
        if (next.flags.musicPlaying) changed = mark(next, 5) || changed;
      }
      if (a.app === "browser" && a.name === "copy_link") {
        changed = setFlag(next, "linkCopied", true) || changed;
      }
      if (a.app === "notes" && a.name === "append_note") {
        if (/https?:|artifact/i.test(String(args.text || "")))
          changed = mark(next, "b1") || changed;
        changed = setFlag(next, "noteAdded", true) || changed;
      }
      if (a.app === "settings" && a.name === "set_theme" && args.theme === "dark") {
        changed = mark(next, "b3") || changed;
      }
    }
    if (
      a.type === "type" &&
      a.window === "terminal" &&
      /npm\s+run\s+dev/i.test(String(a.text || ""))
    ) {
      changed = mark(next, 2) || changed;
    }
    if (a.type === "tile") changed = mark(next, "b2") || changed;
    if (a.type === "resize") {
      const n = (next.flags.resized || 0) + 1;
      changed = setFlag(next, "resized", n) || changed;
      if (n >= 2) changed = mark(next, "b2") || changed;
    }
    if (next.flags.linkCopied && next.flags.noteAdded) changed = mark(next, "b1") || changed;
  }

  return changed ? next : progress;
}
