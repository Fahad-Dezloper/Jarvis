// Unit checks for the playback engine's pure logic. Run: npx tsx scripts/check-runtime.ts
import assert from "node:assert/strict";
import * as pure from "../lib/runtime/pure";
import { RUNTIME_SOURCE } from "../lib/runtime/runtime.source";
import { parseRuntimeEvent } from "../lib/runtime/controller";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log("ok   " + name);
  } catch (err) {
    console.error("FAIL " + name);
    throw err;
  }
}

// ---- tiny fake DOM + selector matcher for the selector subset we emit ----

interface FakeEl extends pure.SelNode {
  children: FakeEl[];
  parent: FakeEl | null;
}

function el(tag: string, opts: { id?: string; classes?: string[] } = {}, children: FakeEl[] = []): FakeEl {
  const node: FakeEl = {
    tag,
    id: opts.id ?? null,
    classes: opts.classes ?? [],
    nth: 1,
    sameTag: 1,
    parent: null,
    children,
  };
  const counts: Record<string, number> = {};
  for (const c of children) {
    c.parent = node;
    counts[c.tag] = (counts[c.tag] ?? 0) + 1;
    c.nth = counts[c.tag];
  }
  for (const c of children) c.sameTag = counts[c.tag];
  return node;
}

function all(root: FakeEl): FakeEl[] {
  return [root, ...root.children.flatMap(all)];
}

function matchesSegment(n: FakeEl, seg: string): boolean {
  let rest = seg;
  const nthMatch = /:nth-of-type\((\d+)\)$/.exec(rest);
  if (nthMatch) {
    if (n.nth !== Number(nthMatch[1])) return false;
    rest = rest.slice(0, nthMatch.index);
  }
  const idMatch = /^#((?:\\.|[^.:])+)/.exec(rest);
  if (idMatch) return n.id === idMatch[1].replace(/\\/g, "");
  const parts = rest.split(".");
  if (parts[0] !== n.tag) return false;
  return parts.slice(1).every((c) => n.classes.includes(c.replace(/\\/g, "")));
}

function matches(n: FakeEl, selector: string): boolean {
  const segs = selector.split(" > ");
  let cur: FakeEl | null = n;
  for (let i = segs.length - 1; i >= 0; i--) {
    if (!cur || !matchesSegment(cur, segs[i])) return false;
    cur = cur.parent;
  }
  return true;
}

function uniqueIn(root: FakeEl) {
  const nodes = all(root);
  return (sel: string) => nodes.filter((n) => matches(n, sel)).length === 1;
}

// ---- tests ----

check("cssEscapeIdent", () => {
  assert.equal(pure.cssEscapeIdent("logo"), "logo");
  assert.equal(pure.cssEscapeIdent("a:b"), "a\\:b");
  assert.equal(pure.cssEscapeIdent("1abc"), "\\31 abc");
  assert.equal(pure.cssEscapeIdent("-"), "\\-");
  assert.equal(pure.cssEscapeIdent("--x"), "--x");
  assert.equal(pure.cssEscapeIdent("a b"), "a\\ b");
});

check("stable class / id heuristics", () => {
  assert.equal(pure.isStableClass("logo"), true);
  assert.equal(pure.isStableClass("btn--primary"), true);
  assert.equal(pure.isStableClass("css-1x2y3z"), false);
  assert.equal(pure.isStableClass("Button_root__3xK9a"), false);
  assert.equal(pure.isStableClass("_a1b2c3"), false);
  assert.equal(pure.isStableClass("mb-hover"), false);
  assert.equal(pure.isStableId("hero"), true);
  assert.equal(pure.isStableId(":r1:"), false);
  assert.equal(pure.isStableId("item-123456"), false);
});

check("selector: stable id wins", () => {
  const target = el("h1", { id: "title" });
  const root = el("html", {}, [el("body", {}, [el("main", {}, [target])])]);
  assert.equal(pure.generateSelector(target, uniqueIn(root)), "#title");
});

check("selector: unique class is enough", () => {
  const target = el("div", { classes: ["logo"] });
  const root = el("html", {}, [el("body", {}, [target, el("div", { classes: ["other"] })])]);
  assert.equal(pure.generateSelector(target, uniqueIn(root)), "div.logo");
});

check("selector: unstable classes are skipped, ancestor added", () => {
  const target = el("span", { classes: ["css-9f8e7d6"] });
  const card = el("section", { classes: ["card"] }, [target]);
  const other = el("section", { classes: ["card2"] }, [el("span", { classes: ["css-111aaa"] })]);
  const root = el("html", {}, [el("body", {}, [card, other])]);
  const sel = pure.generateSelector(target, uniqueIn(root));
  assert.equal(sel, "section.card > span");
});

check("selector: identical siblings fall back to nth-of-type", () => {
  const items = [el("li", { classes: ["item"] }), el("li", { classes: ["item"] }), el("li", { classes: ["item"] })];
  const root = el("html", {}, [el("body", {}, [el("ul", { classes: ["list"] }, items)])]);
  const sel = pure.generateSelector(items[1], uniqueIn(root));
  assert.equal(sel, "li.item:nth-of-type(2)");
  const isUnique = uniqueIn(root);
  assert.ok(isUnique(sel));
});

check("selector: id with special chars is escaped", () => {
  const target = el("div", { id: "my.box" });
  const root = el("html", {}, [el("body", {}, [target])]);
  assert.equal(pure.generateSelector(target, uniqueIn(root)), "#my\\.box");
});

check("computeTotalMs: finite items", () => {
  const r = pure.computeTotalMs([
    { durationMs: 1000, delayMs: 200, iterations: 1 },
    { durationMs: 500, delayMs: 0, iterations: 3 },
    { durationMs: 300, delayMs: 100, endDelayMs: 50, iterations: 2 },
  ]);
  assert.equal(r.totalMs, 1500);
  assert.equal(r.cappedCount, 0);
});

check("computeTotalMs: infinite capped at one iteration", () => {
  const r = pure.computeTotalMs([
    { durationMs: 800, delayMs: 100, iterations: Infinity },
    { durationMs: 400, delayMs: 0, iterations: 1 },
  ]);
  assert.equal(r.totalMs, 900);
  assert.equal(r.cappedCount, 1);
});

check("computeTotalMs: empty and junk values", () => {
  assert.deepEqual(pure.computeTotalMs([]), { totalMs: 0, cappedCount: 0 });
  const r = pure.computeTotalMs([{ durationMs: NaN, delayMs: NaN, iterations: 1 }]);
  assert.equal(r.totalMs, 0);
});

check("summarizeKeyframes", () => {
  const props = pure.summarizeKeyframes([
    { offset: 0, computedOffset: 0, easing: "linear", composite: "auto", transform: "none", opacity: "0" },
    { offset: 1, computedOffset: 1, easing: "linear", composite: "auto", transform: "scale(2)", backgroundColor: "red", cssFloat: "left" },
  ]);
  assert.deepEqual(props, ["transform", "opacity", "background-color", "float"]);
  assert.deepEqual(pure.summarizeKeyframes([]), []);
});

check("gsapAnimatedProps", () => {
  const props = pure.gsapAnimatedProps({
    x: 100, rotation: 360, duration: 2, ease: "power2", repeat: -1, onComplete() {}, css: { opacity: 0 },
  });
  assert.deepEqual(props, ["x", "rotation", "opacity"]);
});

check("SMIL clock values", () => {
  assert.equal(pure.parseClockValue("2s"), 2000);
  assert.equal(pure.parseClockValue("500ms"), 500);
  assert.equal(pure.parseClockValue("1.5"), 1500);
  assert.equal(pure.parseClockValue("00:05"), 5000);
  assert.equal(pure.parseClockValue("01:00:00"), 3600000);
  assert.equal(pure.parseClockValue("indefinite"), Infinity);
  assert.equal(pure.parseClockValue("click"), null);
  assert.equal(pure.parseSmilBegin("1s;3s"), 1000);
  assert.equal(pure.parseSmilBegin("btn.click"), 0);
});

check("buildLabel", () => {
  assert.equal(pure.buildLabel(["opacity"], ".logo", false), "opacity on .logo");
  assert.equal(pure.buildLabel([], null, true), "animation (infinite, shown as 1 iteration)");
});

check("escapeScriptText", () => {
  const out = pure.escapeScriptText("a</script>b<!--c");
  assert.ok(!/<\/script/i.test(out));
  assert.ok(!out.includes("<!--"));
});

check("runtime source: parses and has no template hazards", () => {
  assert.ok(RUNTIME_SOURCE.length > 1000);
  assert.ok(!/<\/script/i.test(RUNTIME_SOURCE));
  // Compiles as a function body (syntax check; does not execute the engine).
  new Function("window", "document", RUNTIME_SOURCE);
});

check("runtime copies agree with pure.ts", () => {
  const w: Record<string, unknown> = { __MB_PURE_ONLY__: true, document: {} };
  new Function("window", "document", RUNTIME_SOURCE)(w, w.document);
  const rt = w.__mbPure as typeof pure;
  assert.ok(rt, "runtime did not expose pure helpers");

  for (const s of ["logo", "a:b", "1abc", "-", "--x", "a b", "é", "x\u0001y"]) {
    assert.equal(rt.cssEscapeIdent(s), pure.cssEscapeIdent(s), "cssEscapeIdent " + s);
  }
  for (const s of ["logo", "css-1x2y3z", "Button_root__3xK9a", "_a1", "mb-x", "btn--primary", ""]) {
    assert.equal(rt.isStableClass(s), pure.isStableClass(s), "isStableClass " + s);
  }
  for (const s of ["hero", ":r1:", "item-123456", "9a", "radix-1"]) {
    assert.equal(rt.isStableId(s), pure.isStableId(s), "isStableId " + s);
  }

  const items = [
    { durationMs: 800, delayMs: 100, iterations: Infinity },
    { durationMs: 500, delayMs: 0, iterations: 3 },
    { durationMs: 300, delayMs: 100, endDelayMs: 50, iterations: 2 },
    { durationMs: NaN, delayMs: NaN, iterations: 1 },
  ];
  assert.deepEqual(rt.computeTotalMs(items), pure.computeTotalMs(items));

  const kfs = [
    { offset: 0, easing: "ease", transform: "none", backgroundColor: "red" },
    { offset: 1, cssFloat: "left", "--x": "1" },
  ];
  assert.deepEqual(rt.summarizeKeyframes(kfs), pure.summarizeKeyframes(kfs));
  const vars = { x: 1, duration: 2, onUpdate() {}, css: { opacity: 1 } };
  assert.deepEqual(rt.gsapAnimatedProps(vars), pure.gsapAnimatedProps(vars));
  for (const s of ["2s", "500ms", "00:05", "indefinite", "click", "1min", ""]) {
    assert.equal(rt.parseClockValue(s), pure.parseClockValue(s), "clock " + s);
  }
  assert.equal(rt.parseSmilBegin("1s;3s"), pure.parseSmilBegin("1s;3s"));
  assert.equal(rt.buildLabel(["a", "b"], ".x", true), pure.buildLabel(["a", "b"], ".x", true));

  // Selector generation must agree on a non-trivial tree.
  const items2 = [el("li", { classes: ["item"] }), el("li", { classes: ["item"] }), el("li", { classes: ["css-abc123"] })];
  const root = el("html", {}, [el("body", {}, [el("ul", { id: "list" }, items2)])]);
  const uniq = uniqueIn(root);
  for (const target of items2) {
    assert.equal(rt.generateSelector(target, uniq), pure.generateSelector(target, uniq));
  }
});

check("parseRuntimeEvent validation", () => {
  assert.deepEqual(parseRuntimeEvent({ type: "mb:ready" }), { type: "mb:ready" });
  assert.equal(parseRuntimeEvent({ type: "mb:time", timeMs: "x", playing: true }), null);
  assert.equal(parseRuntimeEvent({ type: "other" }), null);
  assert.equal(parseRuntimeEvent(null), null);
  assert.ok(parseRuntimeEvent({ type: "mb:time", timeMs: 10, playing: false }));
  assert.equal(parseRuntimeEvent({ type: "mb:animations", animations: {}, totalMs: 1 }), null);
});

console.log("\n" + passed + " checks passed");
