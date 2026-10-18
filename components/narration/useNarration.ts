"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  activeAnimationsAt,
  planAutoPins,
  segmentSentences,
  sentenceAt,
  sentenceKey,
  type Consumed,
} from "@/lib/narration/pure";
import type { AnimationInfo, Pin } from "@/lib/types";

/** How long the playhead must sit still (paused) before unfinished text is pinned. */
export const SETTLE_MS = 700;

export interface NarrationContext {
  timeMs: number;
  playing: boolean;
  animations: AnimationInfo[];
  /** Currently picked element selector, if any. */
  selector: string | null;
}

export interface Narration {
  text: string;
  pins: Pin[];
  setText: (next: string) => void;
  /** Anchor the selection (or the sentence at the caret) to the current moment. */
  pinNow: (selStart: number, selEnd: number) => void;
  updatePin: (id: string, patch: Partial<Pick<Pin, "text" | "timeMs" | "selector">>) => void;
  deletePin: (id: string) => void;
}

/**
 * Narration text plus the pins logged while it was dictated.
 *
 * Pins are created when a sentence is finished, when the player is paused or
 * scrubbed after typing (debounced), and on demand. Each pin is anchored to
 * the playhead time of the last edit, i.e. the frame being described.
 */
export function useNarration(ctx: NarrationContext): Narration {
  const [text, setTextState] = useState("");
  const [pins, setPins] = useState<Pin[]>([]);

  const ctxRef = useRef(ctx);
  const textRef = useRef("");
  const consumedRef = useRef<Consumed[]>([]);
  const lastEditMsRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    ctxRef.current = ctx;
  });

  const makePin = useCallback((pinText: string, timeMs: number): Pin => {
    const c = ctxRef.current;
    idRef.current += 1;
    return {
      id: `pin-${idRef.current}`,
      timeMs,
      selector: c.selector,
      text: pinText,
      measured: activeAnimationsAt(c.animations, timeMs),
    };
  }, []);

  const runPlan = useCallback(
    (value: string, flushTail: boolean, timeMs: number) => {
      const plan = planAutoPins(segmentSentences(value), consumedRef.current, flushTail);
      if (plan.actions.length === 0) {
        consumedRef.current = plan.consumed;
        return;
      }
      const created: Pin[] = [];
      const extended = new Map<string, string>();
      for (const action of plan.actions) {
        if (action.kind === "create") created.push(makePin(action.sentence.text, timeMs));
        else extended.set(action.pinId, action.sentence.text);
      }
      let next = 0;
      consumedRef.current = plan.consumed.map((c) =>
        c.pinId === "" && next < created.length ? { ...c, pinId: created[next++].id } : c,
      );
      setPins((prev) => [
        ...prev.map((p) => (extended.has(p.id) ? { ...p, text: extended.get(p.id) ?? p.text } : p)),
        ...created,
      ]);
    },
    [makePin],
  );

  const setText = useCallback(
    (next: string) => {
      textRef.current = next;
      setTextState(next);
      lastEditMsRef.current = ctxRef.current.timeMs;
      runPlan(next, false, lastEditMsRef.current);
    },
    [runPlan],
  );

  // Pause or seek after typing: pin whatever has not been pinned yet.
  const { playing, timeMs } = ctx;
  useEffect(() => {
    if (playing) return;
    const timer = setTimeout(() => {
      runPlan(textRef.current, true, lastEditMsRef.current);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [playing, timeMs, runPlan]);

  const pinNow = useCallback(
    (selStart: number, selEnd: number) => {
      const value = textRef.current;
      const selected = value.slice(Math.min(selStart, selEnd), Math.max(selStart, selEnd)).trim();
      const sentence = sentenceAt(value, Math.max(selStart, selEnd));
      const now = ctxRef.current.timeMs;
      const key = sentence ? sentenceKey(sentence.text) : "";
      const existing = key ? consumedRef.current.find((c) => c.key === key && c.pinId) : undefined;

      // Re-anchoring an already pinned sentence moves its pin instead of duplicating it.
      if (existing && (!selected || sentenceKey(selected) === key)) {
        const c = ctxRef.current;
        setPins((prev) =>
          prev.map((p) =>
            p.id === existing.pinId
              ? { ...p, timeMs: now, selector: c.selector, measured: activeAnimationsAt(c.animations, now) }
              : p,
          ),
        );
        return;
      }

      const pin = makePin(selected || sentence?.text || "", now);
      if (sentence && !existing) {
        consumedRef.current = [
          ...consumedRef.current,
          { key, pinId: pin.id, complete: sentence.complete },
        ];
      }
      setPins((prev) => [...prev, pin]);
    },
    [makePin],
  );

  const updatePin = useCallback<Narration["updatePin"]>((id, patch) => {
    setPins((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        if (patch.timeMs !== undefined) {
          merged.measured = activeAnimationsAt(ctxRef.current.animations, patch.timeMs);
        }
        return merged;
      }),
    );
  }, []);

  const deletePin = useCallback((id: string) => {
    // The consumed key stays, so a deleted pin is not recreated from the same sentence.
    setPins((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { text, pins, setText, pinNow, updatePin, deletePin };
}
