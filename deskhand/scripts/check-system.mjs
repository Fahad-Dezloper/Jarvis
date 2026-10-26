// Run: npm run check:system
// Known-answer checks for the pure desktop/system logic: wallpaper matching,
// widget kinds and layout, desktop items and Trash, dock names, spotlight ranking.
import assert from "node:assert/strict";
import { WALLPAPERS, resolveWallpaper } from "../src/module/desktop/system/wallpaperCore.js";
import { ANCHORS, layoutWidgets, normalizeAnchor, resolveWidgetKind } from "../src/module/desktop/system/widgetCore.js";
import {
  autoPosition,
  cleanName,
  findByName,
  restoreItem,
  textFileName,
  trashItem,
  uniqueName,
} from "../src/module/desktop/system/desktopItemsCore.js";
import { clampLevel, dockInsert, planShowDesktop, rankMatches, resolveDockApp } from "../src/module/desktop/system/systemCore.js";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
};

// ---- wallpapers
const w = (q, cur = "violet-waves", o) => {
  const r = resolveWallpaper(q, cur, o);
  return r.ok ? r.wallpaper.label : `ERR:${r.message}`;
};
check("catalogue", () => {
  assert.equal(WALLPAPERS.length, 16);
  assert.equal(new Set(WALLPAPERS.map((x) => x.id)).size, 16);
  assert.equal(WALLPAPERS.filter((x) => x.plain).length, 10);
});
check("exact and id", () => {
  assert.equal(w("Midnight"), "Midnight");
  assert.equal(w("space-gray"), "Space Gray");
  assert.equal(w("Teal Waves"), "Teal Waves");
});
check("colour words", () => {
  assert.equal(w("sky blue"), "Sky Blue");
  assert.equal(w("dark blue"), "Dusk Blue");
  assert.equal(w("black"), "Space Black");
  assert.equal(w("make it black please"), "Space Black");
  assert.equal(w("green"), "Forest Green");
  assert.equal(w("white"), "White");
  assert.equal(w("gray"), "Space Gray");
  assert.equal(w("light grey"), "Silver");
  assert.equal(w("the blue one"), "Sky Blue");
});
check("stock keywords and typos", () => {
  assert.equal(w("the anime girl one"), "Autumn Fireside");
  assert.equal(w("fireplace"), "Autumn Fireside");
  assert.equal(w("magnta waves"), "Magenta Waves");
  assert.equal(w("purple curves"), "Purple Curves");
  assert.equal(w("teal"), "Teal Waves");
});
check("numbers and navigation", () => {
  assert.equal(w("3"), "Magenta Waves");
  assert.equal(w("wallpaper 16"), "Dusk Blue");
  assert.match(w("17"), /^ERR:/);
  assert.equal(w("next", "violet-waves"), "Autumn Fireside");
  assert.equal(w("next", "dusk-blue"), "Violet Waves");
  assert.equal(w("previous", "violet-waves"), "Dusk Blue");
  assert.equal(w("random", "violet-waves", { rng: () => 0 }), "Autumn Fireside");
  assert.notEqual(w("random", "teal-waves", { rng: () => 0.99 }), "Teal Waves");
});
check("unknown names are refused with the list", () => {
  const r = resolveWallpaper("zzzzqq", "violet-waves");
  assert.equal(r.ok, false);
  assert.match(r.message, /Violet Waves/);
  assert.equal(resolveWallpaper("", "x").ok, false);
});

// ---- widgets
const kind = (q) => {
  const r = resolveWidgetKind(q);
  return r.ok ? r.kind.type : `ERR`;
};
check("widget kinds", () => {
  assert.equal(kind("clock"), "clock");
  assert.equal(kind("Calendar"), "clock-calendar");
  assert.equal(kind("sticky note"), "notes");
  assert.equal(kind("notes widget"), "notes");
  assert.equal(kind("analog clock"), "analog-clock");
  assert.equal(kind("now playing"), "music");
  assert.equal(kind("spotify widget"), "music");
  assert.equal(kind("weather"), "weather");
  assert.equal(kind("battery"), "battery");
  assert.equal(kind("stocks"), "ERR");
  const bad = resolveWidgetKind("stocks");
  assert.match(bad.message, /clock, .*notes, music/);
});
check("anchors", () => {
  assert.equal(normalizeAnchor("top left"), "top-left");
  assert.equal(normalizeAnchor("bottom-right corner"), "bottom-right");
  assert.equal(normalizeAnchor("upper right"), "top-right");
  assert.equal(normalizeAnchor("middle"), "center");
  assert.equal(normalizeAnchor("left"), "top-left");
  assert.equal(normalizeAnchor("top bottom"), null);
  assert.equal(normalizeAnchor("sideways"), null);
  assert.equal(ANCHORS.length, 5);
});
check("layout maths", () => {
  const vp = { width: 1400, height: 900 };
  const m = { top: 70, side: 40, bottom: 120, gap: 16 };
  const one = layoutWidgets([{ type: "clock", anchor: "top-right", width: 190, height: 130 }], vp, m);
  assert.deepEqual(one.clock, { left: 1400 - 40 - 190, top: 70 });
  const tl = layoutWidgets([{ type: "clock", anchor: "top-left", width: 190, height: 130 }], vp, m);
  assert.deepEqual(tl.clock, { left: 40, top: 70 });
  const bl = layoutWidgets([{ type: "clock", anchor: "bottom-left", width: 190, height: 130 }], vp, m);
  assert.deepEqual(bl.clock, { left: 40, top: 900 - 120 - 130 });
  const br = layoutWidgets([{ type: "clock", anchor: "bottom-right", width: 190, height: 130 }], vp, m);
  assert.deepEqual(br.clock, { left: 1400 - 40 - 190, top: 650 });
  const c = layoutWidgets([{ type: "clock", anchor: "center", width: 200, height: 100 }], vp, m);
  assert.deepEqual(c.clock, { left: 600, top: 70 + (710 - 100) / 2 });
  // stacking: two widgets share a corner, second sits below the first
  const st = layoutWidgets(
    [
      { type: "a", anchor: "top-right", width: 200, height: 200 },
      { type: "b", anchor: "top-right", width: 200, height: 200 },
    ],
    vp,
    m,
  );
  assert.equal(st.b.top, 70 + 216);
  assert.equal(st.a.left, st.b.left);
  // overflow starts a new column to the left of the first
  const col = layoutWidgets(
    [
      { type: "a", anchor: "top-right", width: 200, height: 400 },
      { type: "b", anchor: "top-right", width: 200, height: 400 },
    ],
    vp,
    m,
  );
  assert.equal(col.b.top, 70);
  assert.equal(col.b.left, col.a.left - 216);
  // custom position wins, and is clamped on screen
  const cu = layoutWidgets([{ type: "a", anchor: "top-right", width: 200, height: 100, custom: { left: 5000, top: -50 } }], vp, m);
  assert.deepEqual(cu.a, { left: 1200, top: 62 });
});

// ---- desktop items
check("names", () => {
  assert.equal(cleanName("  a/b:c  ", "x"), "a b c");
  assert.equal(cleanName("", "fallback"), "fallback");
  assert.equal(textFileName("notes"), "notes.txt");
  assert.equal(textFileName("plan.md"), "plan.md");
  const items = [{ id: "1", name: "Trips", kind: "folder", parent: null }];
  assert.equal(uniqueName("trips", items), "trips 2");
  assert.equal(uniqueName("Trips", items, "other"), "Trips");
  assert.equal(uniqueName("Trips", items, null, "1"), "Trips");
  const f = [{ id: "1", name: "a.txt", parent: null }];
  assert.equal(uniqueName("a.txt", f), "a 2.txt");
});
check("find by name", () => {
  const items = [
    { id: "1", name: "Trips" },
    { id: "2", name: "Shopping List.txt" },
  ];
  assert.equal(findByName("shopping list", items).id, "2");
  assert.equal(findByName("the trips folder", items).id, "1");
  assert.equal(findByName("banana", items), null);
});
check("trash and restore", () => {
  const items = [
    { id: "f", name: "Trips", kind: "folder", parent: null },
    { id: "c", name: "plan.txt", kind: "file", parent: "f" },
    { id: "o", name: "other.txt", kind: "file", parent: null },
  ];
  const r = trashItem(items, [], "f", 1);
  assert.deepEqual(r.items.map((i) => i.id), ["o"]);
  assert.deepEqual(r.trash.map((i) => i.id).sort(), ["c", "f"]);
  assert.equal(r.trash[0].trashedAt, 1);
  const back = restoreItem(r.items, r.trash, "f");
  assert.equal(back.restored.name, "Trips");
  assert.equal(back.items.length, 2);
  // name clash on restore
  const clash = restoreItem([{ id: "n", name: "Trips", kind: "folder", parent: null }], r.trash, "f");
  assert.equal(clash.restored.name, "Trips 2");
  assert.equal(trashItem(items, [], "nope").items.length, 3);
});
check("auto position", () => {
  const vp = { width: 1400, height: 900 };
  assert.deepEqual(autoPosition(0, vp), { x: 150, y: 60 });
  assert.deepEqual(autoPosition(1, vp), { x: 150, y: 156 });
  const rows = Math.floor((900 - 60 - 130) / 96);
  assert.deepEqual(autoPosition(rows, vp), { x: 246, y: 60 });
});

// ---- system helpers
check("levels", () => {
  assert.equal(clampLevel(40), 40);
  assert.equal(clampLevel("55%"), 55);
  assert.equal(clampLevel(150), 100);
  assert.equal(clampLevel(-5), 0);
  assert.equal(clampLevel("loud"), null);
  assert.equal(clampLevel(undefined), null);
});
check("show desktop toggle", () => {
  const wins = {
    finder: { isOpen: true, isMinimized: false },
    notes: { isOpen: true, isMinimized: true },
    launchpad: { isOpen: true, isMinimized: false },
    music: { isOpen: false, isMinimized: false },
  };
  assert.deepEqual(planShowDesktop(wins, null), { action: "minimize", keys: ["finder"] });
  const after = { ...wins, finder: { isOpen: true, isMinimized: true } };
  assert.deepEqual(planShowDesktop(after, ["finder"]), { action: "restore", keys: ["finder"] });
  // a window the user closed meanwhile is not resurrected
  assert.deepEqual(planShowDesktop({ finder: { isOpen: false, isMinimized: false } }, ["finder"]), { action: "restore", keys: [] });
});
check("dock names", () => {
  const apps = [
    { id: "finder", name: "Finder" },
    { id: "music", name: "Music" },
    { id: "vscode", name: "VS Code" },
    { id: "settings", name: "Settings" },
    { id: "photos", name: "Photos" },
    { id: "safari", name: "Safari" },
  ];
  assert.equal(resolveDockApp("Spotify", apps).id, "music");
  assert.equal(resolveDockApp("the music app", apps).id, "music");
  assert.equal(resolveDockApp("visual studio code", apps).id, "vscode");
  assert.equal(resolveDockApp("system settings", apps).id, "settings");
  assert.equal(resolveDockApp("gallery", apps).id, "photos");
  assert.equal(resolveDockApp("browser", apps).id, "safari");
  assert.equal(resolveDockApp("photoshop", apps), null);
  assert.deepEqual(dockInsert(["finder", "mail", "folder", "trash"], "music"), ["finder", "mail", "music", "folder", "trash"]);
  assert.deepEqual(dockInsert(["finder", "mail"], "music"), ["finder", "mail", "music"]);
  assert.deepEqual(dockInsert(["finder", "music"], "music"), ["finder", "music"]);
});
check("spotlight ranking", () => {
  const items = [
    { name: "Notes", desc: "Notes", kind: "app" },
    { name: "Shopping List.txt", desc: "Document on Desktop", kind: "file" },
    { name: "Sound Settings", desc: "System Settings", kind: "setting" },
    { name: "Calculator", desc: "Calculator", kind: "app" },
  ];
  assert.equal(rankMatches("calc", items)[0].name, "Calculator");
  assert.equal(rankMatches("shopping", items)[0].name, "Shopping List.txt");
  assert.deepEqual(rankMatches("system settings", items).map((i) => i.name), ["Sound Settings"]);
  assert.deepEqual(rankMatches("zzz", items), []);
  assert.deepEqual(rankMatches("", items), []);
});

console.log(`check-system: ${n} groups passed`);
