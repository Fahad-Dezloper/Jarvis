import type { Pin } from "../types";
import type { FrameSample, PinMark } from "./types";

export const DEFAULT_FPS = 30;
export const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1, 1.5, 2] as const;
const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Frame index containing time `ms`. A tiny epsilon absorbs float error at exact boundaries. */
export function timeToFrame(ms: number, fps: number): number {
  return Math.max(0, Math.floor((ms / 1000) * fps + 1e-6));
}

/** Start time (ms) of a frame. */
export function frameToTimeMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

/**
 * Time to seek to so the browser lands on `frame`. Seeking to the exact
 * boundary can round to the previous frame, so aim for the frame's middle.
 */
export function frameSeekSeconds(frame: number, fps: number): number {
  return (Math.max(0, frame) + 0.5) / fps;
}

/** Frame step target, clamped to [0, lastFrame]. */
export function stepFrame(current: number, delta: number, lastFrame: number): number {
  return clamp(current + delta, 0, Math.max(0, lastFrame));
}

/**
 * Estimate fps from requestVideoFrameCallback samples. Only consecutive
 * presented frames (presentedFrames advanced by exactly 1) are used, then the
 * median interval is taken so seeks and dropped frames do not skew it.
 * Returns null when there is not enough evidence.
 */
export function estimateFps(samples: FrameSample[], minPairs = 5): number | null {
  const deltas: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dp = samples[i].presentedFrames - samples[i - 1].presentedFrames;
    const dt = samples[i].mediaTime - samples[i - 1].mediaTime;
    if (dp === 1 && dt > 0.001 && dt < 0.5) deltas.push(dt);
  }
  if (deltas.length < minPairs) return null;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const median = deltas.length % 2 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
  const raw = 1 / median;
  let best: number | null = null;
  for (const c of COMMON_FPS) {
    const err = Math.abs(raw - c) / c;
    if (err < 0.015 && (best === null || err < Math.abs(raw - best) / best)) best = c;
  }
  if (best !== null) return best;
  return Math.round(raw * 100) / 100;
}

/** m:ss.mmm */
export function formatTime(ms: number): string {
  const safe = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const total = Math.round(safe);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const milli = total % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(milli).padStart(3, "0")}`;
}

/** m:ss for counters. */
export function formatClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function sortPins(pins: Pin[]): Pin[] {
  return [...pins].sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
}

// ---- click-to-mark, encoded as a text suffix: "note [mark 0.412,0.733]" ----

const MARK_RE = /\s*\[mark (\d(?:\.\d+)?),(\d(?:\.\d+)?)\]\s*$/;

export function parseMark(text: string): PinMark | null {
  const m = MARK_RE.exec(text);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

export function stripMark(text: string): string {
  return text.replace(MARK_RE, "");
}

export function withMark(text: string, mark: PinMark | null): string {
  const base = stripMark(text);
  if (!mark) return base;
  const x = clamp(mark.x, 0, 1).toFixed(3);
  const y = clamp(mark.y, 0, 1).toFixed(3);
  return `${base} [mark ${x},${y}]`.trimStart();
}

/** Human wording for the mark, used in narration. */
export function describeMark(mark: PinMark): string {
  return `at ${Math.round(mark.x * 100)}% across, ${Math.round(mark.y * 100)}% down the frame`;
}

// ---- geometry for object-fit: contain ----

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Rendered picture box inside an element using object-fit: contain. */
export function containBox(elW: number, elH: number, vidW: number, vidH: number): Box {
  if (elW <= 0 || elH <= 0 || vidW <= 0 || vidH <= 0) return { left: 0, top: 0, width: elW, height: elH };
  const scale = Math.min(elW / vidW, elH / vidH);
  const width = vidW * scale;
  const height = vidH * scale;
  return { left: (elW - width) / 2, top: (elH - height) / 2, width, height };
}

/** Pointer position (relative to the element) to normalised picture coordinates; null if outside the picture. */
export function pointToMark(px: number, py: number, box: Box): PinMark | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const x = (px - box.left) / box.width;
  const y = (py - box.top) / box.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

// ---- MediaRecorder mime selection ----

export const RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm;codecs=h264",
  "video/webm",
  "video/mp4;codecs=avc1",
  "video/mp4",
] as const;

export function pickMimeType(isSupported: (type: string) => boolean): string | null {
  for (const t of RECORDER_MIME_CANDIDATES) {
    try {
      if (isSupported(t)) return t;
    } catch {
      // keep trying
    }
  }
  return null;
}

export function extensionForMime(mime: string): string {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

/** Accept by MIME or extension (browsers report .mov as video/quicktime, or "" on some systems). */
export function isAcceptedVideoFile(name: string, type: string): boolean {
  if (/^video\/(mp4|webm|quicktime)$/.test(type)) return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(name);
}
