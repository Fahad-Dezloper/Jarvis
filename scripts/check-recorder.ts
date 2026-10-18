// Run: npm run check:recorder
import assert from "node:assert/strict";
import {
  clamp, containBox, estimateFps, extensionForMime, formatClock, formatTime, frameSeekSeconds,
  frameToTimeMs, isAcceptedVideoFile, parseMark, pickMimeType, pointToMark, sortPins, stepFrame,
  stripMark, timeToFrame, withMark,
} from "../lib/recorder/pure";
import type { FrameSample } from "../lib/recorder/types";
import type { Pin } from "../lib/types";

// clamp
assert.equal(clamp(5, 0, 3), 3);
assert.equal(clamp(-1, 0, 3), 0);
assert.equal(clamp(NaN, 2, 3), 2);

// frame <-> time
assert.equal(frameToTimeMs(30, 30), 1000);
assert.equal(timeToFrame(1000, 30), 30);
assert.equal(timeToFrame(999.9, 30), 29);
assert.equal(timeToFrame(frameToTimeMs(7, 29.97), 29.97), 7); // boundary float error
assert.equal(timeToFrame(-5, 30), 0);
assert.ok(Math.abs(frameSeekSeconds(3, 30) - 3.5 / 30) < 1e-12);
assert.equal(timeToFrame(frameSeekSeconds(12, 24) * 1000, 24), 12);
assert.equal(stepFrame(5, -10, 100), 0);
assert.equal(stepFrame(95, 10, 100), 100);
assert.equal(stepFrame(5, 1, 100), 6);

// fps estimation
function samples(fps: number, n: number, jitter = 0): FrameSample[] {
  return Array.from({ length: n }, (_, i) => ({
    mediaTime: i / fps + (i % 2 ? jitter : 0),
    presentedFrames: i + 100,
  }));
}
assert.equal(estimateFps(samples(30, 20)), 30);
assert.equal(estimateFps(samples(60, 20)), 60);
assert.equal(estimateFps(samples(24, 20)), 24);
assert.equal(estimateFps(samples(30000 / 1001, 20)), 29.97);
// 29.97 and 30 are indistinguishable under jitter; either is acceptable
assert.ok([29.97, 30].includes(estimateFps(samples(30, 20, 0.0002)) ?? -1));
assert.equal(estimateFps(samples(30, 4)), null); // too few
assert.equal(estimateFps([]), null);
assert.equal(estimateFps(samples(12.5, 20)), 12.5); // uncommon rate passes through
{
  // seeks (large presentedFrames gaps / media jumps) are ignored
  const s = samples(30, 20);
  s.splice(10, 0, { mediaTime: 50, presentedFrames: 109 });
  s.forEach((x, i) => { if (i > 10) x.presentedFrames += 5; });
  assert.equal(estimateFps(s), 30);
}
{
  // dropped frames: presentedFrames skips -> those pairs are not used
  const s: FrameSample[] = [];
  let p = 0;
  for (let i = 0; i < 30; i++) { p += i % 5 === 0 ? 2 : 1; s.push({ mediaTime: i / 25, presentedFrames: p }); }
  assert.equal(estimateFps(s), 25);
}

// formatting
assert.equal(formatTime(0), "0:00.000");
assert.equal(formatTime(65432), "1:05.432");
assert.equal(formatTime(-10), "0:00.000");
assert.equal(formatTime(NaN), "0:00.000");
assert.equal(formatClock(61999), "1:01");

// pin sorting is stable and non-mutating
const pins: Pin[] = [
  { id: "b", timeMs: 500, selector: null, text: "b" },
  { id: "a", timeMs: 500, selector: null, text: "a" },
  { id: "c", timeMs: 100, selector: null, text: "c" },
];
assert.deepEqual(sortPins(pins).map((p) => p.id), ["c", "a", "b"]);
assert.deepEqual(pins.map((p) => p.id), ["b", "a", "c"]);

// marks
assert.equal(withMark("overshoot", { x: 0.41234, y: 0.7 }), "overshoot [mark 0.412,0.700]");
assert.deepEqual(parseMark("overshoot [mark 0.412,0.700]"), { x: 0.412, y: 0.7 });
assert.equal(stripMark("overshoot [mark 0.412,0.700]"), "overshoot");
assert.equal(parseMark("no mark here"), null);
assert.equal(parseMark("x [mark 1.500,0.2]"), null);
assert.equal(withMark("a [mark 0.1,0.1]", null), "a");
assert.equal(withMark("a [mark 0.1,0.1]", { x: 1, y: 0 }), "a [mark 1.000,0.000]");
assert.equal(withMark("", { x: 0.5, y: 0.5 }), "[mark 0.500,0.500]");
assert.deepEqual(parseMark(withMark("", { x: 0.5, y: 0.5 })), { x: 0.5, y: 0.5 });

// letterbox geometry: 16:9 video in a square element
const box = containBox(400, 400, 1600, 900);
assert.equal(box.width, 400);
assert.equal(box.height, 225);
assert.equal(box.top, 87.5);
assert.equal(pointToMark(200, 200, box)?.x, 0.5);
assert.equal(pointToMark(200, 200, box)?.y, 0.5);
assert.equal(pointToMark(200, 10, box), null); // in the letterbox bar
assert.deepEqual(pointToMark(0, 87.5, box), { x: 0, y: 0 });

// mime picking
assert.equal(pickMimeType(() => false), null);
assert.equal(pickMimeType((t) => t === "video/webm"), "video/webm");
assert.equal(pickMimeType((t) => t.startsWith("video/mp4")), "video/mp4;codecs=avc1");
assert.equal(pickMimeType(() => true), "video/webm;codecs=vp9");
assert.equal(pickMimeType((t) => { if (t.includes("vp9")) throw new Error("x"); return true; }), "video/webm;codecs=vp8");
assert.equal(extensionForMime("video/mp4;codecs=avc1"), "mp4");
assert.equal(extensionForMime("video/webm;codecs=vp9"), "webm");

// file acceptance
assert.ok(isAcceptedVideoFile("a.mov", ""));
assert.ok(isAcceptedVideoFile("a", "video/webm"));
assert.ok(isAcceptedVideoFile("A.MP4", "application/octet-stream"));
assert.ok(!isAcceptedVideoFile("a.gif", "image/gif"));

console.log("check-recorder: all assertions passed");
