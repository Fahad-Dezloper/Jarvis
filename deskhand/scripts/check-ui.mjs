// Pure-logic checks for the Deskhand UI. Run: npm run check:ui
import assert from "node:assert/strict";
import { humanize, windowLabel } from "../src/module/deskhand/humanize.js";
import { trimHistory, MAX_TURNS } from "../src/module/deskhand/history.js";
import {
  BONUS,
  MISSIONS,
  countDone,
  initialProgress,
  isComplete,
  isHinvPlaying,
  snapshotStore,
  tickMissions,
} from "../src/module/deskhand/missionsLogic.js";

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`ok  ${name}`);
};

// ---- humanize ----
check("humanize window actions", () => {
  assert.equal(humanize({ type: "open", window: "terminal" }), "Opening Terminal");
  assert.equal(humanize({ type: "close", window: "music" }), "Closing Music");
  assert.equal(humanize({ type: "minimize", window: "notes" }), "Minimizing Notes");
  assert.equal(humanize({ type: "focus", window: "safari" }), "Switching to Safari");
  assert.equal(humanize({ type: "open", window: "weird_app" }), "Opening Weird app");
});
check("humanize invoke actions", () => {
  assert.equal(
    humanize({
      type: "invoke",
      app: "terminal",
      name: "run_command",
      args: { command: "npm run dev" },
    }),
    "Running: npm run dev",
  );
  assert.equal(
    humanize({ type: "invoke", app: "music", name: "play", args: { query: "HiNV Music" } }),
    "Playing HiNV Music",
  );
  assert.equal(humanize({ type: "invoke", app: "music", name: "play" }), "Resuming music");
  assert.equal(
    humanize({ type: "invoke", app: "settings", name: "set_theme", args: { theme: "dark" } }),
    "Switching to dark mode",
  );
  assert.equal(
    humanize({ type: "invoke", app: "music", name: "set_volume", args: { level: 40.4 } }),
    "Setting volume to 40%",
  );
  assert.equal(
    humanize({
      type: "invoke",
      app: "settings",
      name: "set_setting",
      args: { key: "wifi", value: false },
    }),
    "Turning wifi off",
  );
  assert.equal(humanize({ type: "invoke", app: "x", name: "do_thing" }), "do thing (X)");
});
check("humanize layout, type, say, junk", () => {
  assert.equal(humanize({ type: "tile", layout: "grid" }), "Arranging windows in a grid");
  assert.equal(humanize({ type: "type", window: "notes", text: "hello" }), 'Typing "hello"');
  assert.equal(humanize({ type: "say", text: "Hi there" }), "Hi there");
  assert.equal(humanize(null), "Working");
  assert.equal(humanize({ type: "nope" }), "Working");
});
check("humanize truncates long text", () => {
  const out = humanize({
    type: "invoke",
    app: "terminal",
    name: "run_command",
    args: { command: "x".repeat(300) },
  });
  assert.ok(out.length < 90, out.length);
  assert.ok(out.endsWith("…"));
  assert.equal(windowLabel("vscode"), "VS Code");
});

// ---- history ----
check("trimHistory keeps the last 6 turns", () => {
  let h = [];
  for (let i = 1; i <= 9; i++) h = trimHistory(h, { command: `c${i}`, reply: `r${i}` });
  assert.equal(h.length, MAX_TURNS);
  assert.equal(h[0].command, "c4");
  assert.equal(h.at(-1).reply, "r9");
});
check("trimHistory is pure and tolerant", () => {
  const base = [{ command: "a", reply: "b" }];
  const out = trimHistory(base, { command: "c", reply: undefined });
  assert.equal(base.length, 1);
  assert.deepEqual(out[1], { command: "c", reply: "" });
  assert.deepEqual(trimHistory(undefined, null), []);
});

// ---- missions ----
const store = (over = {}) =>
  snapshotStore({
    windows: { terminal: { isOpen: false }, music: { isOpen: false } },
    music: { isPlaying: false, activeTrack: { title: "Select a Song" } },
    systemSettings: { darkMode: true },
    ...over,
  });
const ok = (action) => ({ type: "step", index: 0, status: "ok", action });

check("opening and closing the terminal ticks 1 then 3", () => {
  let p = initialProgress();
  p = tickMissions(p, { store: store() });
  assert.equal(p.done[3], undefined, "close before open must not tick");
  p = tickMissions(p, {
    store: store({ windows: { terminal: { isOpen: true }, music: { isOpen: false } } }),
  });
  assert.ok(p.done[1]);
  assert.equal(p.done[3], undefined);
  p = tickMissions(p, { store: store() });
  assert.ok(p.done[3]);
});
check("npm run dev tick comes from run_command events only when ok", () => {
  let p = initialProgress();
  const action = {
    type: "invoke",
    app: "terminal",
    name: "run_command",
    args: { command: "npm run dev" },
  };
  p = tickMissions(p, { event: { type: "step", index: 0, status: "start", action } });
  assert.equal(p.done[2], undefined);
  p = tickMissions(p, { event: { type: "step", index: 0, status: "fail", action } });
  assert.equal(p.done[2], undefined);
  p = tickMissions(p, { event: ok({ ...action, args: { command: "ls" } }) });
  assert.equal(p.done[2], undefined);
  p = tickMissions(p, { event: ok(action) });
  assert.ok(p.done[2]);
});
check("music window and HiNV playlist", () => {
  let p = initialProgress();
  p = tickMissions(p, {
    store: store({ windows: { terminal: { isOpen: false }, music: { isOpen: true } } }),
  });
  assert.ok(p.done[4]);
  assert.equal(p.done[5], undefined);
  const playing = (extra) => ({ isPlaying: true, activeTrack: { title: "t", ...extra } });
  assert.equal(isHinvPlaying(playing({ playlist: "Other" })), false);
  assert.equal(isHinvPlaying({ isPlaying: false, playlist: "HiNV Music" }), false);
  assert.equal(isHinvPlaying({ isPlaying: true, playlist: "HiNV Music", activeTrack: {} }), true);
  assert.equal(isHinvPlaying(playing({ album: "hinv music" })), true);
  p = tickMissions(p, { store: store({ music: playing({ album: "HiNV Music" }) }) });
  assert.ok(p.done[5]);
});
check("play event then playing state also ticks step 5", () => {
  let p = initialProgress();
  p = tickMissions(p, {
    event: ok({ type: "invoke", app: "music", name: "play", args: { query: "HiNV Music" } }),
  });
  assert.equal(p.done[5], undefined);
  p = tickMissions(p, {
    store: store({ music: { isPlaying: true, activeTrack: { title: "x" } } }),
  });
  assert.ok(p.done[5]);
});
check("tickMissions returns the same object when nothing changes", () => {
  const p = tickMissions(initialProgress(), { store: store() });
  assert.equal(tickMissions(p, { store: store() }), p);
  assert.equal(tickMissions(p, {}), p);
});
check("completion and counts", () => {
  const p = { done: { 1: true, 2: true, 3: true, 4: true, 5: true }, flags: {} };
  assert.ok(isComplete(p));
  assert.equal(countDone(p), 5);
  assert.equal(countDone(initialProgress()), 0);
  assert.equal(MISSIONS.length, 5);
});
check("bonus: dark mode, tile, resize, notes link", () => {
  let p = initialProgress();
  p = tickMissions(p, { store: store({ systemSettings: { darkMode: false } }) });
  assert.equal(p.done.b3, undefined);
  p = tickMissions(p, { store: store({ systemSettings: { darkMode: true } }) });
  assert.ok(p.done.b3);
  p = tickMissions(p, { event: ok({ type: "tile", layout: "grid" }) });
  assert.ok(p.done.b2);

  let q = initialProgress();
  q = tickMissions(q, { event: ok({ type: "resize", window: "notes", width: 1, height: 1 }) });
  assert.equal(q.done.b2, undefined);
  q = tickMissions(q, { event: ok({ type: "resize", window: "music", width: 1, height: 1 }) });
  assert.ok(q.done.b2);

  let r = initialProgress();
  r = tickMissions(r, {
    event: ok({ type: "invoke", app: "browser", name: "copy_link", args: {} }),
  });
  assert.equal(r.done.b1, undefined);
  r = tickMissions(r, {
    event: ok({ type: "invoke", app: "notes", name: "append_note", args: { text: "x" } }),
  });
  assert.ok(r.done.b1);
  assert.equal(countDone(r, BONUS), 1);
});

console.log(`\n${passed} checks passed`);
