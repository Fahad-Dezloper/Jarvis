// Known-answer checks for the Orry engine (pure logic only; no browser, no network).
// Run: npm run check:engine
import assert from "node:assert/strict";
import { planWithRules, mentionedApps, cleanText, splitCommand } from "../src/deskhand/engine/rules.js";
import { sanitizeAction, sanitizeActions, planFromModelOutput, MAX_ACTIONS } from "../src/deskhand/engine/schema.js";
import { computeTiles, clampRect } from "../src/deskhand/engine/layout.js";
import { trimSnapshot, bestElement, labelScore, MAX_ELEMENTS_PER_WINDOW } from "../src/deskhand/engine/snapshot-core.js";

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};

const vp = { width: 1440, height: 900, top: 35, bottom: 810 };
const win = (key, z = 1000, extra = {}) => ({ key, title: key, z, minimized: false, maximized: false, ...extra });
const types = (p) => p.actions.map((a) => a.type);
const inv = (p) => p.actions.filter((a) => a.type === "invoke").map((a) => `${a.app}.${a.name}`);

// ---------- rules parser ----------
const plan = (t, ctx) => planWithRules(t, ctx);

check("open Claude Code", () => {
  const p = plan("open Claude Code");
  assert.deepEqual(p.actions, [{ type: "open", window: "terminal" }]);
  assert.equal(p.source, "rules");
});
check("run npm run dev", () => {
  const p = plan("run npm run dev");
  assert.deepEqual(p.actions.at(-1), { type: "invoke", app: "terminal", name: "run_command", args: { command: "npm run dev" } });
  assert.equal(p.actions[0].type, "open");
});
check("run in terminal already open skips open", () => {
  const p = plan("run ls -la in the terminal", { snapshot: { windows: [win("terminal")], viewport: vp } });
  assert.equal(p.actions.length, 1);
  assert.equal(p.actions[0].args.command, "ls -la");
});
check("close it uses history", () => {
  const p = plan("close it", {
    history: [{ command: "run npm run dev", reply: "x" }, { command: "open Claude Code", reply: "y" }],
    snapshot: { windows: [win("terminal"), win("notes", 900)], focused: "notes", viewport: vp },
  });
  assert.deepEqual(p.actions, [{ type: "close", window: "terminal" }]);
});
check("close it falls back to front window", () => {
  const p = plan("close this", { snapshot: { windows: [win("terminal", 1001), win("notes", 1005)], viewport: vp } });
  assert.deepEqual(p.actions, [{ type: "close", window: "notes" }]);
});
check("open then close it in one sentence", () => {
  const p = plan("open notes and then close it");
  assert.deepEqual(p.actions, [{ type: "open", window: "notes" }, { type: "close", window: "notes" }]);
});
check("open Spotify -> music", () => assert.deepEqual(plan("open Spotify").actions, [{ type: "open", window: "music" }]));
check("play the HiNV Music playlist", () => {
  const p = plan("play the HiNV Music playlist");
  assert.deepEqual(p.actions.at(-1), { type: "invoke", app: "music", name: "play", args: { query: "HiNV Music" } });
});
check("play music resumes", () => {
  const a = plan("play some music").actions.at(-1);
  assert.deepEqual(a.args, {});
});
check("save this link to my notes", () => {
  const p = plan("save this link to my notes");
  assert.deepEqual(inv(p), ["browser.copy_link", "notes.append_note"]);
  assert.equal(p.actions.at(-1).args.text, "{{clipboard}}");
});
check("save the github link to notes sets element", () => {
  const p = plan("save the github link to my notes");
  assert.equal(p.actions.find((a) => a.name === "copy_link").args.element, "github");
});
check("resize the windows so they all look good", () => {
  const p = plan("resize the windows so they all look good");
  assert.deepEqual(p.actions, [{ type: "tile", layout: "grid" }]);
});
check("arrange my windows side by side", () => assert.equal(plan("arrange my windows side by side").actions[0].layout, "columns"));
check("cascade", () => assert.equal(plan("cascade the windows").actions[0].layout, "cascade"));
check("messy dictation with filler", () => {
  const p = plan("Uh, hey, can you please open the, um, terminal");
  assert.deepEqual(p.actions, [{ type: "open", window: "terminal" }]);
});
check("self-correction keeps last intent", () => {
  assert.deepEqual(plan("open notes, no wait, open the calculator").actions, [{ type: "open", window: "calculator" }]);
});
check("sequencing with and then", () => {
  const p = plan("open terminal and then open notes and play some music");
  assert.deepEqual(types(p), ["open", "open", "open", "invoke"]);
  assert.deepEqual(p.actions.map((a) => a.window ?? a.name), ["terminal", "notes", "music", "play"]);
});
check("open two apps in one verb", () => {
  assert.deepEqual(plan("open terminal and notes").actions.map((a) => a.window), ["terminal", "notes"]);
});
check("close everything uses open windows", () => {
  const p = plan("close everything", { snapshot: { windows: [win("terminal"), win("notes")], viewport: vp } });
  assert.deepEqual(p.actions.map((a) => `${a.type}:${a.window}`).sort(), ["close:notes", "close:terminal"]);
});
check("minimize / maximize / restore / focus", () => {
  const snap = { windows: [win("notes"), win("terminal", 1100)], viewport: vp };
  assert.deepEqual(plan("minimize notes", { snapshot: snap }).actions, [{ type: "minimize", window: "notes" }]);
  assert.deepEqual(plan("make the terminal full screen", { snapshot: snap }).actions.at(-1), { type: "maximize", window: "terminal" });
  assert.deepEqual(plan("maximize notes", { snapshot: snap }).actions, [{ type: "maximize", window: "notes" }]);
  assert.deepEqual(plan("restore notes", { snapshot: snap }).actions, [{ type: "restore", window: "notes" }]);
  assert.deepEqual(plan("switch to notes", { snapshot: snap }).actions, [{ type: "focus", window: "notes" }]);
});
check("browser synonyms", () => {
  assert.equal(plan("open the browser").actions[0].window, "safari");
  assert.equal(plan("open chrome").actions[0].window, "chrome");
  assert.equal(plan("launch the files app").actions[0].window, "finder");
  assert.equal(plan("open preferences").actions[0].window, "settings");
  assert.equal(plan("start vs code").actions[0].window, "vscode");
  assert.equal(plan("fire up the console").actions[0].window, "terminal");
  assert.equal(plan("open notepad").actions[0].window, "notes");
});
check("put notes on the left half", () => {
  const p = plan("put notes on the left half", { snapshot: { windows: [win("notes")], viewport: vp } });
  assert.deepEqual(types(p), ["resize", "move"]);
  assert.equal(p.actions[1].x, 8);
  assert.ok(p.actions[0].width < 720);
});
check("put it on the right side", () => {
  const p = plan("put the terminal on the right", { snapshot: { windows: [win("terminal")], viewport: vp } });
  assert.ok(p.actions.find((a) => a.type === "move").x > 700);
});
check("pause / next / previous", () => {
  assert.deepEqual(inv(plan("pause the music")), ["music.pause"]);
  assert.deepEqual(inv(plan("stop")), ["music.pause"]);
  assert.deepEqual(inv(plan("skip this song")), ["music.next"]);
  assert.deepEqual(inv(plan("next track")), ["music.next"]);
  assert.deepEqual(inv(plan("previous song")), ["music.previous"]);
});
check("volume", () => {
  assert.equal(plan("set the volume to 40").actions[0].args.level, 40);
  assert.equal(plan("volume up", { snapshot: { windows: [], music: { volume: 50 }, viewport: vp } }).actions[0].args.level, 65);
  assert.equal(plan("turn the volume down", { snapshot: { windows: [], music: { volume: 10 }, viewport: vp } }).actions[0].args.level, 0);
  assert.equal(plan("make it louder", { snapshot: { windows: [], music: { volume: 99 }, viewport: vp } }).actions[0].args.level, 100);
});
check("notes writing", () => {
  const a = plan("write buy milk and eggs").actions.at(-1);
  assert.deepEqual(a, { type: "invoke", app: "notes", name: "append_note", args: { text: "buy milk and eggs" } });
  assert.equal(plan("jot down call mom tomorrow in my notes").actions.at(-1).args.text, "call mom tomorrow");
});
check("theme and toggles", () => {
  assert.deepEqual(plan("dark mode").actions, [{ type: "invoke", app: "settings", name: "set_theme", args: { theme: "dark" } }]);
  assert.equal(plan("switch to light mode").actions[0].args.theme, "light");
  assert.deepEqual(plan("turn wifi off").actions[0].args, { key: "wifi", value: false });
  assert.deepEqual(plan("enable bluetooth").actions[0].args, { key: "bluetooth", value: true });
});
check("demo mission sequence", () => {
  const phrases = ["open Claude Code", "run npm run dev", "open Spotify", "play the HiNV Music playlist", "save this link to my notes", "resize the windows so they all look good"];
  for (const ph of phrases) {
    const p = plan(ph);
    assert.ok(p.actions.length > 0, ph);
    assert.ok(p.reply.length > 3, ph);
  }
});
check("unknown request refuses with no actions", () => {
  const p = plan("what is the capital of France");
  assert.deepEqual(p.actions, []);
  assert.ok(/can't/i.test(p.reply));
});
check("note field is carried", () => assert.equal(plan("open notes", { note: "offline" }).note, "offline"));
check("helpers", () => {
  assert.deepEqual(mentionedApps("open claude code and spotify"), ["terminal", "music"]);
  assert.equal(cleanText("Um, please open notes."), "open notes");
  assert.deepEqual(splitCommand("open notes, then close it"), ["open notes", "close it"]);
});

// ---------- allowlist validation ----------
check("rejects unknown action types", () => {
  assert.equal(sanitizeAction({ type: "eval", code: "alert(1)" }), null);
  assert.equal(sanitizeAction({ type: "navigate", url: "https://x.y" }), null);
  assert.equal(sanitizeAction(null), null);
});
check("rejects unknown windows", () => assert.equal(sanitizeAction({ type: "open", window: "../etc" }), null));
check("clamps numbers", () => {
  const a = sanitizeAction({ type: "resize", window: "notes", width: 99999, height: -4 });
  assert.deepEqual(a, { type: "resize", window: "notes", width: 4000, height: 150 });
  assert.equal(sanitizeAction({ type: "move", window: "notes", x: Infinity, y: 0 }), null);
});
check("invoke only allowlisted capabilities", () => {
  assert.equal(sanitizeAction({ type: "invoke", app: "fs", name: "rm", args: {} }), null);
  assert.equal(sanitizeAction({ type: "invoke", app: "music", name: "format_disk" }), null);
  assert.equal(sanitizeAction({ type: "invoke", app: "music", name: "set_volume", args: {} }), null);
  assert.equal(sanitizeAction({ type: "invoke", app: "music", name: "set_volume", args: { level: 900 } }).args.level, 100);
  assert.deepEqual(sanitizeAction({ type: "invoke", app: "music", name: "pause", args: { evil: 1 } }).args, {});
});
check("blocks dangerous urls and settings keys", () => {
  assert.equal(sanitizeAction({ type: "invoke", app: "browser", name: "open_url", args: { url: "javascript:alert(1)" } }), null);
  assert.equal(sanitizeAction({ type: "invoke", app: "browser", name: "open_url", args: { url: "data:text/html,x" } }), null);
  assert.equal(sanitizeAction({ type: "invoke", app: "browser", name: "open_url", args: { url: "ftp://x.y" } }), null);
  assert.ok(sanitizeAction({ type: "invoke", app: "browser", name: "open_url", args: { url: "https://example.com" } }));
  assert.equal(sanitizeAction({ type: "invoke", app: "settings", name: "set_setting", args: { key: "firewall", value: false } }), null);
});
check("caps action count and drops bad ones", () => {
  const many = Array.from({ length: 20 }, () => ({ type: "focus", window: "notes" }));
  assert.equal(sanitizeActions([{ type: "bogus" }, ...many]).length, MAX_ACTIONS);
  assert.deepEqual(sanitizeActions("nope"), []);
});
check("model output mapping parses args_json", () => {
  const p = planFromModelOutput({
    reply: "Playing it.",
    actions: [
      { type: "open", window: "music", args_json: null },
      { type: "invoke", app: "music", name: "play", args_json: '{"query":"HiNV Music"}' },
      { type: "invoke", app: "music", name: "play", args_json: "{not json" },
      { type: "hack" },
    ],
  });
  assert.equal(p.actions.length, 2);
  assert.deepEqual(p.actions[1].args, { query: "HiNV Music" });
  assert.equal(p.reply, "Playing it.");
});

// ---------- snapshot trimming ----------
check("trimSnapshot caps elements, strings and shapes", () => {
  const elements = Array.from({ length: 200 }, (_, i) => ({ id: `dk-${i}`, role: "button", label: "x".repeat(500) }));
  const s = trimSnapshot({
    windows: [win("notes"), { nokey: true }],
    elements: { notes: elements, bad: "nope" },
    clipboard: "y".repeat(2000),
    summaries: { music: "z".repeat(5000) },
    settings: { wifi: true, secret: { a: 1 }, name: "str" },
    junk: "dropped",
  });
  assert.equal(s.windows.length, 1);
  assert.equal(s.elements.notes.length, MAX_ELEMENTS_PER_WINDOW);
  assert.ok(s.elements.notes[0].label.length <= 80);
  assert.ok(s.clipboard.length <= 300);
  assert.ok(s.summaries.music.length <= 400);
  assert.deepEqual(s.settings, { wifi: true });
  assert.equal(s.junk, undefined);
  assert.equal(trimSnapshot(null).windows.length, 0);
});
check("element matching", () => {
  const list = [
    { id: "dk-1", role: "button", label: "New Note" },
    { id: "dk-2", role: "button", label: "Delete" },
    { id: "dk-3", role: "tab", label: "Settings and more" },
  ];
  assert.equal(bestElement("dk-2", list).id, "dk-2");
  assert.equal(bestElement("new note", list).id, "dk-1");
  assert.equal(bestElement("delete button", list).id, "dk-2");
  assert.equal(bestElement("zebra", list), null);
  assert.ok(labelScore("save", "Save") > labelScore("save", "Save as"));
});

// ---------- layout ----------
check("tiles stay inside the area and do not overlap (grid of 3 and 4)", () => {
  const area = { left: 0, top: 35, width: 1440, height: 760 };
  for (const n of [1, 2, 3, 4, 5]) {
    const cells = computeTiles(n, "grid", area);
    assert.equal(cells.length, n);
    for (const c of cells) {
      assert.ok(c.left >= 0 && c.top >= 35 && c.left + c.width <= 1440 && c.top + c.height <= 795, JSON.stringify(c));
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = cells[i], b = cells[j];
        const overlap = a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
        assert.ok(!overlap, `${n}: ${i} overlaps ${j}`);
      }
  }
  const three = computeTiles(3, "grid", area);
  assert.ok(three[2].width > three[0].width, "last row expands");
  assert.equal(computeTiles(3, "columns", area).length, 3);
  assert.equal(computeTiles(3, "rows", area)[1].top > computeTiles(3, "rows", area)[0].top, true);
  assert.equal(computeTiles(3, "cascade", area)[1].left - computeTiles(3, "cascade", area)[0].left, 40);
});
check("clampRect keeps windows below the menu bar", () => {
  const c = clampRect({ left: -50, top: -20, width: 600, height: 400 }, { left: 0, top: 35, width: 1440, height: 760 });
  assert.deepEqual([c.left, c.top], [0, 35]);
  const d = clampRect({ left: 1300, top: 900, width: 600, height: 400 }, { left: 0, top: 35, width: 1440, height: 760 });
  assert.equal(d.left + d.width, 1440);
  assert.equal(d.top + d.height, 795);
});

console.log(`${passed} checks passed${process.exitCode ? " (with failures)" : ""}`);
