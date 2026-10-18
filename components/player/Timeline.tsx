"use client";

import type { AnimationInfo } from "@/lib/types";
import { formatMs } from "./Transport";
import type { Playback } from "./usePlayback";

const KIND_STYLE: Record<AnimationInfo["kind"], { bar: string; chip: string; name: string }> = {
  css: { bar: "bg-sky-500/70", chip: "text-sky-300 bg-sky-500/10", name: "CSS" },
  waapi: { bar: "bg-emerald-500/70", chip: "text-emerald-300 bg-emerald-500/10", name: "WAAPI" },
  gsap: { bar: "bg-lime-500/70", chip: "text-lime-300 bg-lime-500/10", name: "GSAP" },
  smil: { bar: "bg-amber-500/70", chip: "text-amber-300 bg-amber-500/10", name: "SMIL" },
};

/** Visible span of a lane: finite iterations are shown in full, infinite as one. */
function laneSpan(a: AnimationInfo): { start: number; length: number } {
  const count = isFinite(a.iterations) ? Math.max(0, a.iterations) : 1;
  return { start: Math.max(0, a.delayMs), length: Math.max(0, a.durationMs * count) };
}

export interface TimelineProps {
  playback: Playback;
  /** Called when a lane with a selector is clicked. */
  onSelectLane?: (animation: AnimationInfo) => void;
  className?: string;
}

export function Timeline({ playback, onSelectLane, className = "" }: TimelineProps) {
  const { animations, timeMs, totalMs, seek, ready } = playback;
  const pct = totalMs > 0 ? Math.min(100, (timeMs / totalMs) * 100) : 0;

  return (
    <div className={"rounded-xl border border-white/10 bg-zinc-900/80 p-3 " + className}>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={Math.max(totalMs, 1)}
          step={1}
          value={Math.min(timeMs, Math.max(totalMs, 1))}
          disabled={!ready || totalMs <= 0}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Playhead position"
          aria-valuetext={formatMs(timeMs)}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-zinc-500">
          <span>0 ms</span>
          <span className="text-violet-300">{formatMs(timeMs)}</span>
          <span>{formatMs(totalMs)}</span>
        </div>
      </div>

      <div className="mt-3 border-t border-white/5 pt-3">
        {animations.length === 0 ? (
          <p className="py-3 text-center text-sm text-zinc-500">
            {ready ? "No animations found in the preview yet." : "Waiting for the preview runtime..."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {animations.map((a) => {
              const { start, length } = laneSpan(a);
              const left = totalMs > 0 ? (start / totalMs) * 100 : 0;
              const width = totalMs > 0 ? Math.max(0.8, (length / totalMs) * 100) : 0;
              const style = KIND_STYLE[a.kind];
              const infinite = !isFinite(a.iterations);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onSelectLane?.(a)}
                    title={
                      a.label +
                      "\nduration " + Math.round(a.durationMs) + " ms, delay " + Math.round(a.delayMs) +
                      " ms, easing " + a.easing +
                      ", iterations " + (infinite ? "infinite" : a.iterations)
                    }
                    className="group grid w-full grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 rounded-md px-1.5 py-1 text-left hover:bg-white/5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={"shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] " + style.chip}>
                        {style.name}
                      </span>
                      <span className="truncate text-xs text-zinc-300">{a.properties.join(", ") || "animation"}</span>
                    </span>
                    <span className="relative h-5 rounded bg-zinc-800/80">
                      <span
                        className={"absolute top-0.5 bottom-0.5 rounded " + style.bar}
                        style={{ left: left + "%", width: Math.min(width, 100 - left) + "%" }}
                      />
                      {infinite && (
                        <span
                          className="absolute top-0 bottom-0 right-1 flex items-center font-mono text-[10px] text-zinc-400"
                          aria-label="infinite"
                        >
                          loops
                        </span>
                      )}
                      <span
                        className="absolute top-0 bottom-0 w-px bg-violet-300"
                        style={{ left: pct + "%" }}
                        aria-hidden
                      />
                    </span>
                  </button>
                  {a.selector && (
                    <div className="truncate pl-1.5 font-mono text-[10px] text-zinc-500">{a.selector}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
