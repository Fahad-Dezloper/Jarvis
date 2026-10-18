import assert from "node:assert/strict";
import {
  activeAnimationsAt,
  countWords,
  planAutoPins,
  segmentSentences,
  sentenceAt,
  sentenceKey,
  type Consumed,
} from "../lib/narration/pure";
import type { AnimationInfo } from "../lib/types";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("ok  " + name);
}

test("segments sentences and keeps decimals intact", () => {
  const s = segmentSentences("It starts at 0.3s and fades. Then it bounces! Done");
  assert.deepEqual(
    s.map((x) => x.text),
    ["It starts at 0.3s and fades.", "Then it bounces!", "Done"],
  );
  assert.deepEqual(s.map((x) => x.complete), [true, true, false]);
});

test("offsets point back into the source", () => {
  const text = "  One. Two?  ";
  for (const s of segmentSentences(text)) assert.equal(text.slice(s.start, s.end), s.text);
});

test("newline ends a sentence", () => {
  const s = segmentSentences("before the frame\nat the frame");
  assert.equal(s.length, 2);
  assert.equal(s[0].complete, true);
  assert.equal(s[1].complete, false);
});

test("ellipsis and closing quotes stay with the sentence", () => {
  const s = segmentSentences('It says "go!" Then waits... ok');
  assert.deepEqual(s.map((x) => x.text), ['It says "go!"', "Then waits...", "ok"]);
});

test("empty and whitespace-only text", () => {
  assert.deepEqual(segmentSentences(""), []);
  assert.deepEqual(segmentSentences("  \n \n"), []);
  assert.equal(countWords("  "), 0);
  assert.equal(countWords(" a  b\nc "), 3);
});

test("sentenceAt finds the caret sentence", () => {
  const t = "First one. Second one. Third";
  assert.equal(sentenceAt(t, 14)?.text, "Second one.");
  assert.equal(sentenceAt(t, t.length)?.text, "Third");
  assert.equal(sentenceAt("", 0), null);
});

test("complete sentences create pins, the tail waits", () => {
  const sents = segmentSentences("Card slides in. Then the icon");
  const r = planAutoPins(sents, [], false);
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].kind, "create");
  assert.equal(r.consumed.length, 1);
});

test("flushTail pins the unfinished sentence once", () => {
  const sents = segmentSentences("Card slides in. Then the icon");
  const first = planAutoPins(sents, [], false);
  const withIds: Consumed[] = first.consumed.map((c, i) => ({ ...c, pinId: "p" + i }));
  const second = planAutoPins(sents, withIds, true);
  assert.equal(second.actions.length, 1);
  assert.equal(second.actions[0].kind, "create");
  const again = planAutoPins(sents, second.consumed.map((c, i) => ({ ...c, pinId: "p" + i })), true);
  assert.equal(again.actions.length, 0);
});

test("finishing a flushed fragment extends the same pin, no duplicate", () => {
  const frag = segmentSentences("Then the icon");
  const flushed = planAutoPins(frag, [], true);
  const consumed = flushed.consumed.map((c) => ({ ...c, pinId: "p1" }));
  const full = segmentSentences("Then the icon bounces twice.");
  const r = planAutoPins(full, consumed, false);
  assert.equal(r.actions.length, 1);
  assert.deepEqual(
    r.actions[0].kind === "extend" ? r.actions[0].pinId : null,
    "p1",
  );
  assert.equal(r.consumed[0].complete, true);
  assert.equal(planAutoPins(full, r.consumed, true).actions.length, 0);
});

test("deleted pins are not recreated (consumed keys persist)", () => {
  const sents = segmentSentences("It fades in.");
  const r = planAutoPins(sents, [{ key: sentenceKey("It fades in."), pinId: "gone", complete: true }], true);
  assert.equal(r.actions.length, 0);
});

test("whitespace and case changes do not make a new sentence", () => {
  const r = planAutoPins(
    segmentSentences("It  FADES in."),
    [{ key: sentenceKey("It fades in."), pinId: "a", complete: true }],
    true,
  );
  assert.equal(r.actions.length, 0);
});

test("two identical sentences produce two pins", () => {
  const r = planAutoPins(segmentSentences("It pops. It pops."), [], false);
  assert.equal(r.actions.length, 2);
});

const anim = (id: string, delayMs: number, durationMs: number, iterations: number): AnimationInfo => ({
  id, kind: "css", label: id, selector: "." + id, durationMs, delayMs, easing: "ease", iterations, properties: ["opacity"],
});

test("activeAnimationsAt respects delay, duration and infinite loops", () => {
  const list = [anim("a", 0, 500, 1), anim("b", 400, 300, 1), anim("c", 100, 200, Infinity)];
  assert.deepEqual(activeAnimationsAt(list, 450).map((x) => x.id), ["a", "b", "c"]);
  assert.deepEqual(activeAnimationsAt(list, 50).map((x) => x.id), ["a"]);
  assert.deepEqual(activeAnimationsAt(list, 5000).map((x) => x.id), ["c"]);
});

console.log(`\n${passed} narration checks passed`);
