// Pure narration logic: sentence segmentation, pin planning, measurements.
// No React, no DOM, so it can be checked from Node (scripts/check-narration.ts).

import type { AnimationInfo } from "@/lib/types";

export interface Sentence {
  text: string;
  /** Offsets into the source string, end exclusive, trimmed of whitespace. */
  start: number;
  end: number;
  /** True when the sentence ends with terminal punctuation or a line break. */
  complete: boolean;
}

const TERMINATORS = ".!?…";
const CLOSERS = "\"')]}”’";

/** Collapse whitespace and lowercase, so edits that only change spacing match. */
export function sentenceKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/**
 * Split narration into sentences. A sentence ends at . ! ? (or an ellipsis)
 * followed by whitespace or the end of the text, or at a line break. A period
 * inside "0.3s" or "1.5x" is not a boundary because no whitespace follows it.
 */
export function segmentSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  const push = (rawEnd: number, complete: boolean) => {
    let s = start;
    let e = rawEnd;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) out.push({ text: text.slice(s, e), start: s, end: e, complete });
    start = rawEnd;
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      push(i + 1, true);
      i++;
      continue;
    }
    if (TERMINATORS.includes(ch)) {
      let j = i + 1;
      while (j < text.length && (TERMINATORS.includes(text[j]) || CLOSERS.includes(text[j]))) j++;
      if (j >= text.length || /\s/.test(text[j])) {
        push(j, true);
        i = j;
        continue;
      }
      i = j;
      continue;
    }
    i++;
  }
  if (start < text.length) push(text.length, false);
  return out;
}

/** The sentence containing the caret (or the closest one before it). */
export function sentenceAt(text: string, caret: number): Sentence | null {
  const all = segmentSentences(text);
  if (all.length === 0) return null;
  const hit = all.find((s) => caret >= s.start && caret <= s.end);
  if (hit) return hit;
  const before = [...all].reverse().find((s) => s.end <= caret);
  return before ?? all[0];
}

/** A sentence that already produced (or was merged into) a pin. */
export interface Consumed {
  key: string;
  pinId: string;
  complete: boolean;
}

export type PinAction =
  | { kind: "create"; sentence: Sentence }
  | { kind: "extend"; pinId: string; sentence: Sentence };

export interface PlanResult {
  actions: PinAction[];
  /** Consumed list after applying actions. New pins get pinId "" until the caller fills it in. */
  consumed: Consumed[];
}

/**
 * Decide which pins an edit should produce.
 *
 * - A complete sentence not yet seen creates a pin ("a new sentence started").
 * - An unfinished tail only becomes a pin when `flushTail` is set (the player
 *   was paused or sought after typing).
 * - A sentence that extends an earlier unfinished pin updates that pin
 *   instead of making a duplicate.
 */
export function planAutoPins(
  sentences: Sentence[],
  consumed: Consumed[],
  flushTail: boolean,
): PlanResult {
  const next = consumed.map((c) => ({ ...c }));
  const claimed = new Set<number>();
  const actions: PinAction[] = [];

  for (const s of sentences) {
    const key = sentenceKey(s.text);
    if (!key) continue;

    const same = next.findIndex((c, idx) => !claimed.has(idx) && c.key === key);
    if (same !== -1) {
      claimed.add(same);
      // A previously flushed fragment that is now finished.
      if (s.complete) next[same].complete = true;
      continue;
    }

    const prefix = next.findIndex(
      (c, idx) => !claimed.has(idx) && !c.complete && c.pinId !== "" && key.startsWith(c.key),
    );
    if (prefix !== -1) {
      claimed.add(prefix);
      const pinId = next[prefix].pinId;
      next[prefix] = { key, pinId, complete: s.complete };
      actions.push({ kind: "extend", pinId, sentence: s });
      continue;
    }

    if (s.complete || flushTail) {
      next.push({ key, pinId: "", complete: s.complete });
      claimed.add(next.length - 1);
      actions.push({ kind: "create", sentence: s });
    }
  }
  return { actions, consumed: next };
}

/** Animations running (or about to hold a value) at a given time. */
export function activeAnimationsAt(animations: AnimationInfo[], timeMs: number): AnimationInfo[] {
  return animations.filter((a) => {
    const start = Math.max(0, a.delayMs);
    if (timeMs < start) return false;
    if (!isFinite(a.iterations)) return true;
    const end = start + a.durationMs * Math.max(0, a.iterations);
    return timeMs <= end;
  });
}

export function formatPinTime(ms: number): string {
  const safe = isFinite(ms) ? Math.max(0, ms) : 0;
  return safe < 10_000 ? `${Math.round(safe)} ms` : `${(safe / 1000).toFixed(2)} s`;
}
