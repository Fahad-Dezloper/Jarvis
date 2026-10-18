"use client";

import { useEffect, useRef } from "react";
import { Crosshair, MapPin, Mic } from "lucide-react";
import { countWords, formatPinTime } from "@/lib/narration/pure";
import type { Narration } from "./useNarration";

export interface NarrationPanelProps {
  narration: Narration;
  timeMs: number;
  /** Selector the next pin will be tied to. */
  selector: string | null;
}

const PLACEHOLDER =
  "Talk through what happens before this frame, at this frame, and after it...\n\n" +
  "Example: Before this, the card is sliding in from the left. At this frame it overshoots and the " +
  "icon starts to bounce. After it, the glow should settle instead of snapping.";

const MAX_HEIGHT_PX = 380;

export function NarrationPanel({ narration, timeMs, selector }: NarrationPanelProps) {
  const { text, setText, pinNow } = narration;
  const ref = useRef<HTMLTextAreaElement>(null);
  const pinRef = useRef(pinNow);

  useEffect(() => {
    pinRef.current = pinNow;
  });

  // Auto-grow with the content, up to a cap, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT_PX) + "px";
  }, [text]);

  const pinSelection = () => {
    const el = ref.current;
    pinRef.current(el?.selectionStart ?? text.length, el?.selectionEnd ?? text.length);
  };

  // Alt+P pins from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyP") {
        e.preventDefault();
        const el = ref.current;
        pinRef.current(el?.selectionStart ?? 0, el?.selectionEnd ?? 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const words = countWords(text);

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-3.5 shadow-lg shadow-black/30">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Mic className="size-4 text-[#8b7cff]" />
          Narrate
        </h2>
        <span className="text-[11px] tabular-nums text-zinc-500">
          {words} {words === 1 ? "word" : "words"}
        </span>
      </div>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            pinSelection();
          }
        }}
        placeholder={PLACEHOLDER}
        spellCheck
        aria-label="Narration"
        className="block min-h-[150px] w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3.5 text-[15px] leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#8b7cff]/70 focus:shadow-[0_0_0_3px_rgba(139,124,255,0.15)]"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={pinSelection}
          title="Pin this moment (Ctrl/Cmd+Enter in the box, or Alt+P)"
          className="btn-primary"
        >
          <MapPin className="size-3.5" />
          Pin this moment
        </button>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="font-mono tabular-nums text-amber-200">{formatPinTime(timeMs)}</span>
          <Crosshair className="size-3 shrink-0" />
          <span className="truncate font-mono" title={selector ?? undefined}>
            {selector ?? "no element picked"}
          </span>
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        Dictate or type. Pins are logged as you finish sentences and when you pause or scrub the player.
        Ctrl/Cmd+Enter or Alt+P pins the selection or current sentence.
      </p>
    </div>
  );
}
