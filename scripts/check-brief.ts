// Run: npx tsx scripts/check-brief.ts
import assert from "node:assert/strict";
import { detectVocabulary } from "../lib/brief/vocabulary";
import { buildHeuristicBrief, extractTimeMs, splitSentences } from "../lib/brief/heuristic";
import { briefInputSchema, briefOutputSchema } from "../lib/brief/schema";
import type { AnimationInfo, BriefInput } from "../lib/types";

delete process.env.ANTHROPIC_API_KEY;

const logoAnim: AnimationInfo = {
  id: "a1", kind: "css", label: "transform on .logo", selector: ".logo",
  durationMs: 900, delayMs: 0, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", iterations: 1, properties: ["transform"],
};
const listAnim: AnimationInfo = {
  id: "a2", kind: "gsap", label: "opacity on .item", selector: ".item",
  durationMs: 600, delayMs: 1000, easing: "linear", iterations: 1, properties: ["opacity", "y"],
};

const input: BriefInput = {
  componentName: "Hero",
  files: {
    "Hero.css": ".logo {\n  animation: pop 900ms cubic-bezier(0.34, 1.56, 0.64, 1);\n}\n.item { color: red; }",
    "Hero.tsx": "gsap.to('.item', { opacity: 1, y: 0, duration: 0.6, ease: 'none' });",
  },
  animations: [logoAnim, listAnim],
  narration:
    "The logo overshoots and snaps back, I want it to settle softly. Before this the list feels sluggish. At this point the items all show up at the same time, and it is a bit jittery.",
  pins: [
    { id: "p1", timeMs: 700, selector: ".logo", text: "the logo overshoots and snaps back, I want it to settle softly" },
    { id: "p2", timeMs: 1300, selector: ".item", text: "items appear all at once, should stagger", measured: [listAnim] },
  ],
  goal: "Make the intro feel calm",
};

// vocabulary
const ids = (t: string) => detectVocabulary(t).map((m) => m.entry.id);
assert.ok(ids("the logo overshoots and snaps back").includes("overshoot"));
assert.ok(ids("I want it to settle softly").includes("settle"));
assert.ok(ids("feels floaty and sluggish").includes("floaty"));
assert.ok(ids("feels floaty and sluggish").includes("sluggish"));
assert.ok(ids("it is jittery").includes("jittery"));
assert.ok(ids("use ease-in-out").includes("ease-in-out"));
assert.ok(!ids("use ease-in-out").includes("ease-in"));
assert.ok(ids("stagger them").includes("stagger"));
assert.deepEqual(ids("nothing about motion here, just a button"), []);

// helpers
assert.equal(extractTimeMs("at around 1.2 seconds it jumps"), 1200);
assert.equal(extractTimeMs("at 800ms"), 800);
assert.equal(extractTimeMs("no time here"), null);
assert.equal(splitSentences("One thing. Two things! Three?").length, 3);

// schema
assert.ok(briefInputSchema.safeParse(input).success);
assert.ok(!briefInputSchema.safeParse({ ...input, narration: "x".repeat(12_001) }).success);
assert.ok(!briefInputSchema.safeParse({ ...input, files: { a: "x".repeat(60_001) } }).success);
assert.ok(!briefInputSchema.safeParse({ ...input, pins: Array.from({ length: 51 }, (_, i) => ({ id: `${i}`, timeMs: 0, selector: null, text: "t" })) }).success);

// heuristic
const brief = buildHeuristicBrief(input);
assert.equal(brief.source, "heuristic");
assert.ok(briefOutputSchema.safeParse(brief).success);
assert.ok(brief.issues.length >= 3, "pins plus uncovered narration sentences");
const logo = brief.issues.find((i) => i.selector === ".logo")!;
assert.ok(logo.currentValues.includes("900ms") && logo.currentValues.includes("cubic-bezier(0.34, 1.56, 0.64, 1)"));
assert.ok(/overshoots by construction/.test(logo.suggestedChange), "ties overshoot to measured easing");
assert.ok(/damping/i.test(logo.suggestedChange));
const items = brief.issues.find((i) => i.selector === ".item" && i.timeMs === 1300)!;
assert.ok(/stagger/i.test(items.suggestedChange));
assert.ok(items.currentValues.includes("linear"));
assert.deepEqual(brief.issues.map((i) => i.timeMs).filter((t) => t != null), [...brief.issues.map((i) => i.timeMs).filter((t): t is number => t != null)].sort((a, b) => a - b));
assert.ok(brief.prompt.includes("Hero.css:2"), "cites code lines");
assert.ok(/do not change unrelated behaviour/i.test(brief.constraints.join(" ")));
assert.ok(brief.prompt.includes("Make the intro feel calm"));

// empty input still yields a valid, honest brief
const empty = buildHeuristicBrief({ componentName: "X", files: {}, animations: [], narration: "", pins: [] });
assert.equal(empty.issues.length, 0);
assert.ok(briefOutputSchema.safeParse(empty).success);

// route (heuristic path, no key)
async function routeTests() {
  const { POST, GET } = await import("../app/api/brief/route");
  const g = await (await GET()).json();
  assert.deepEqual(g, { modelAvailable: false });

  const mk = (b: unknown, ip: string) =>
    new Request("http://localhost/api/brief", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(b),
    });

  const ok = await POST(mk(input, "1.1.1.1"));
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.source, "heuristic");
  assert.ok(briefOutputSchema.safeParse(body).success);

  const bad = await POST(mk({ componentName: "" }, "2.2.2.2"));
  assert.equal(bad.status, 400);
  const notJson = await POST(new Request("http://localhost/api/brief", { method: "POST", headers: { "x-forwarded-for": "3.3.3.3" }, body: "{nope" }));
  assert.equal(notJson.status, 400);

  // A bogus user key must never be echoed, and failure falls back with a note.
  const secret = "sk-ant-test-SECRET-123";
  const keyed = await POST(new Request("http://localhost/api/brief", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "4.4.4.4", "x-anthropic-key": secret },
    body: JSON.stringify(input),
  }));
  const text = await keyed.text();
  assert.ok(!text.includes(secret));
  const kb = JSON.parse(text);
  assert.equal(kb.source, "heuristic");
  assert.ok(typeof kb.note === "string");

  let last = 200;
  for (let i = 0; i < 12; i++) last = (await POST(mk(input, "9.9.9.9"))).status;
  assert.equal(last, 429);
}

routeTests().then(() => console.log("check-brief: all assertions passed"), (e) => { console.error(e); process.exit(1); });
