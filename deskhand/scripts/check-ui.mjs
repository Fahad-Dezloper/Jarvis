// Pure-logic checks for the Jarvis UI. Run: npm run check:ui
import assert from "node:assert/strict";
import { humanize, windowLabel } from "../src/module/deskhand/humanize.js";
import { trimHistory, MAX_TURNS } from "../src/module/deskhand/history.js";
import {
  QUIET_MS,
  cleanCommand,
  decideCommit,
  isCommittable,
  isRealEditable,
  shouldCaptureFocus,
} from "../src/module/deskhand/voiceLogic.js";
import {
  deriveSubtitle,
  logVisible,
  resultDuration,
  sourceBadge,
} from "../src/module/deskhand/subtitleLogic.js";
import {
  BONUS,
  CHALLENGES,
  CORE_MISSIONS,
  MISSIONS,
  isAllComplete,
  progressLabel,
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
  assert.equal(MISSIONS.length, 7);
  assert.equal(CORE_MISSIONS.length, 5);
  assert.equal(CHALLENGES.length, 2);
  assert.ok(CHALLENGES.every((m) => m.challenge));
  assert.deepEqual(
    MISSIONS.map((m) => m.id),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(isAllComplete(p), false);
  assert.equal(progressLabel(p), "5 of 7");
  assert.equal(progressLabel(initialProgress()), "0 of 7");
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

// ---- challenge missions ----
const stepOk = (action) => ({ type: "step", index: 0, status: "ok", action });
const done = (reply = "Done.", ok = true) => ({ type: "done", reply, ok });

check("challenge 6: Claude Code + folder + read, ticks on a good done", () => {
  let p = initialProgress();
  p = tickMissions(p, { event: stepOk({ type: "open", window: "terminal" }) });
  p = tickMissions(p, { event: stepOk({ type: "open", window: "finder" }) });
  p = tickMissions(p, { event: done("ok") });
  assert.equal(p.done[6], undefined, "no read yet and a short reply");
  p = tickMissions(p, {
    event: stepOk({
      type: "invoke",
      app: "terminal",
      name: "run_command",
      args: { command: "cat README.md" },
    }),
  });
  p = tickMissions(p, { event: done("It is a voice controlled desktop.", false) });
  assert.equal(p.done[6], undefined, "failed run must not tick");
  p = tickMissions(p, { event: done("Done.") });
  assert.ok(p.done[6]);
});
check("challenge 6: observation event counts as reading; unknown events are ignored", () => {
  let p = initialProgress();
  p = tickMissions(p, { event: stepOk({ type: "open", window: "terminal" }) });
  p = tickMissions(p, { event: stepOk({ type: "click", window: "finder", target: "project" }) });
  p = tickMissions(p, { event: { type: "observation", text: "files..." } });
  const same = tickMissions(p, { event: { type: "something-new", x: 1 } });
  assert.equal(same, p);
  p = tickMissions(p, { event: done() });
  assert.ok(p.done[6]);
});
check("challenge 7: needs open, a Paradigm search, then opening a result", () => {
  let p = initialProgress();
  p = tickMissions(p, { event: stepOk({ type: "open", window: "chrome" }) });
  p = tickMissions(p, { event: done() });
  assert.equal(p.done[7], undefined);
  p = tickMissions(p, {
    event: stepOk({
      type: "invoke",
      app: "browser",
      name: "open_url",
      args: { url: "https://www.google.com/search?q=Paradigm+research+papers" },
    }),
  });
  p = tickMissions(p, { event: done() });
  assert.equal(p.done[7], undefined, "a search alone is not enough");
  p = tickMissions(p, {
    event: stepOk({ type: "click", window: "chrome", target: "latest paper" }),
  });
  p = tickMissions(p, { event: done() });
  assert.ok(p.done[7]);
});
check("challenge 7 does not tick without Paradigm", () => {
  let p = initialProgress();
  p = tickMissions(p, { event: stepOk({ type: "open", window: "chrome" }) });
  p = tickMissions(p, {
    event: stepOk({
      type: "invoke",
      app: "browser",
      name: "open_url",
      args: { url: "https://www.google.com/search?q=cats" },
    }),
  });
  p = tickMissions(p, { event: stepOk({ type: "click", window: "chrome", target: "x" }) });
  p = tickMissions(p, { event: done() });
  assert.equal(p.done[7], undefined);
});

// ---- voice capture logic ----
check("cleanCommand trims and strips newlines", () => {
  assert.equal(cleanCommand("  open  notes \n"), "open notes");
  assert.equal(cleanCommand("open\r\nnotes\n\n"), "open notes");
  assert.equal(cleanCommand(null), "");
});
check("strict commit rejects stray one-word noise but keeps real commands", () => {
  for (const noise of ["you", "Thank you.", "okay", "um", "Hello", "yes"]) assert.equal(isCommittable(noise, { strict: true }), false, noise);
  for (const ok of ["pause", "next", "open notes", "close it", "play music"]) assert.equal(isCommittable(ok, { strict: true }), true, ok);
  assert.equal(isCommittable("okay", { strict: false }), true); // typed + Enter is always allowed
});
check("isCommittable needs at least 2 non-space characters", () => {
  assert.equal(isCommittable("   \n "), false);
  assert.equal(isCommittable(" a "), false);
  assert.equal(isCommittable("go"), true);
  assert.equal(isCommittable("a b"), true);
});
check("decideCommit: waits while text is arriving, commits after the quiet window", () => {
  const base = { value: "open notes", changedAt: 1000, quietMs: QUIET_MS };
  assert.equal(QUIET_MS, 1300);
  let d = decideCommit({ ...base, now: 1200 });
  assert.equal(d.action, "wait");
  assert.equal(d.waitMs, 1100);
  d = decideCommit({ ...base, now: 1000 + QUIET_MS - 1 });
  assert.equal(d.action, "wait");
  d = decideCommit({ ...base, now: 1000 + QUIET_MS });
  assert.equal(d.action, "commit");
  assert.equal(d.text, "open notes");
});
check("decideCommit: chunked paste keeps resetting the window", () => {
  // second chunk lands at t=900, so at t=2000 only 1100ms have passed since the last change
  const d = decideCommit({ value: "open notes and", changedAt: 900, now: 2000 });
  assert.equal(d.action, "wait");
});
check("decideCommit: Enter commits immediately, tolerates trailing newline", () => {
  const d = decideCommit({ value: "close it\n", changedAt: 5000, now: 5001, enter: true });
  assert.deepEqual([d.action, d.text], ["commit", "close it"]);
});
check("decideCommit: whitespace and single chars are discarded, not sent", () => {
  assert.equal(decideCommit({ value: "  \n", changedAt: 0, now: 5000 }).action, "discard");
  assert.equal(decideCommit({ value: "x", changedAt: 0, now: 5000 }).action, "discard");
  assert.equal(decideCommit({ value: "  ", changedAt: 0, now: 0, enter: true }).action, "discard");
});
check("decideCommit: nothing changed means nothing to do; busy engine holds the text", () => {
  assert.equal(decideCommit({ value: "", changedAt: null, now: 9e9 }).action, "none");
  const d = decideCommit({ value: "play music", changedAt: 0, now: 5000, busy: true });
  assert.deepEqual([d.action, d.text], ["hold", "play music"]);
});
check("isRealEditable: real inputs yes, capture field and buttons no", () => {
  const capture = { tagName: "TEXTAREA" };
  assert.equal(isRealEditable({ tagName: "TEXTAREA" }, capture), true);
  assert.equal(isRealEditable(capture, capture), false);
  assert.equal(isRealEditable({ tagName: "INPUT", type: "text" }, capture), true);
  assert.equal(isRealEditable({ tagName: "INPUT", type: "search" }, capture), true);
  assert.equal(isRealEditable({ tagName: "INPUT", type: "checkbox" }, capture), false);
  assert.equal(isRealEditable({ tagName: "INPUT", type: "text", readOnly: true }, capture), false);
  assert.equal(isRealEditable({ tagName: "DIV", isContentEditable: true }, capture), true);
  assert.equal(isRealEditable({ tagName: "BUTTON" }, capture), false);
  assert.equal(isRealEditable(null, capture), false);
});
check("shouldCaptureFocus: do not steal from real inputs, force wins, Escape pauses", () => {
  const capture = { tagName: "TEXTAREA" };
  const notes = { tagName: "TEXTAREA" };
  assert.equal(shouldCaptureFocus(notes, capture), false);
  assert.equal(shouldCaptureFocus({ tagName: "BODY" }, capture), true);
  assert.equal(shouldCaptureFocus(null, capture), true);
  assert.equal(shouldCaptureFocus(notes, capture, { force: true }), true);
  assert.equal(shouldCaptureFocus({ tagName: "BODY" }, capture, { paused: true }), false);
});

// ---- subtitle logic ----
check("deriveSubtitle: live transcript wins, then running, then result, then listening", () => {
  assert.equal(deriveSubtitle({}).kind, "none");
  assert.equal(deriveSubtitle({ listening: true }).kind, "listening");
  const live = deriveSubtitle({ live: " open notes ", status: "running", listening: true });
  assert.deepEqual([live.kind, live.text], ["live", "open notes"]);
  const run = deriveSubtitle({ status: "running", command: "open notes" });
  assert.deepEqual([run.kind, run.text], ["running", "open notes"]);
  const rep = deriveSubtitle({ reply: "Opened Notes.", source: "model", showResult: true });
  assert.deepEqual([rep.kind, rep.text, rep.badge.text], ["reply", "Opened Notes.", "AI"]);
  assert.equal(deriveSubtitle({ reply: "Opened Notes.", showResult: false }).kind, "none");
});
check("deriveSubtitle: failures use the warning kind", () => {
  assert.equal(deriveSubtitle({ error: "Boom", showResult: true }).kind, "error");
  assert.equal(
    deriveSubtitle({ reply: "Stopped.", cancelled: true, showResult: true }).kind,
    "error",
  );
  assert.equal(deriveSubtitle({ reply: "Could not.", ok: false, showResult: true }).kind, "error");
});
check("sourceBadge, resultDuration, logVisible", () => {
  assert.equal(sourceBadge("model").text, "AI");
  assert.equal(sourceBadge("rules").text, "Offline");
  assert.equal(sourceBadge(null), null);
  assert.equal(resultDuration("Done."), 3500);
  assert.ok(resultDuration("x".repeat(400)) <= 12000);
  assert.ok(resultDuration("x".repeat(200)) > 3500);
  assert.ok(resultDuration("Oops", true) > resultDuration("Oops"));
  assert.equal(logVisible({ status: "running", pinned: false, actionCount: 2 }), true);
  assert.equal(logVisible({ status: "idle", pinned: false, actionCount: 2 }), false);
  assert.equal(logVisible({ status: "idle", pinned: true, actionCount: 2 }), true);
  assert.equal(logVisible({ status: "running", pinned: true, actionCount: 0 }), false);
});

console.log(`\n${passed} checks passed`);
