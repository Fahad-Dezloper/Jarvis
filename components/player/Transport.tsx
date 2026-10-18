"use client";

import { useEffect } from "react";
import { Crosshair, Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import { FRAME_MS, type Playback } from "./usePlayback";

export { usePlayback, FRAME_MS } from "./usePlayback";
export type { Playback } from "./usePlayback";

const RATES = [0.1, 0.25, 0.5, 1, 1.5, 2];

export function formatMs(ms: number): string {
  const safe = isFinite(ms) ? Math.max(0, ms) : 0;
  return safe.toFixed(0).padStart(4, "0") + " ms";
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return type !== "range" && type !== "checkbox" && type !== "button";
  }
  return false;
}

function IconButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 " +
        "disabled:cursor-not-allowed disabled:opacity-40 " +
        (active
          ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
          : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

export interface TransportProps {
  playback: Playback;
  /** Bind space and arrow keys on the window. Default true. */
  enableKeys?: boolean;
  className?: string;
}

export function Transport({ playback, enableKeys = true, className = "" }: TransportProps) {
  const { playing, timeMs, totalMs, rate, pickMode, ready } = playback;
  const { toggle, step, restart, setRate, setPickMode } = playback;

  useEffect(() => {
    if (!enableKeys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === " " || e.code === "Space") {
        // Let focused buttons keep their native space-to-click behavior.
        if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return;
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-FRAME_MS * (e.shiftKey ? 10 : 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(FRAME_MS * (e.shiftKey ? 10 : 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableKeys, toggle, step]);

  return (
    <div
      className={
        "flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 " +
        className
      }
    >
      <div className="flex items-center gap-1.5">
        <IconButton label="Step back one frame (Left arrow)" onClick={() => step(-FRAME_MS)} disabled={!ready}>
          <StepBack size={16} />
        </IconButton>
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause (Space)" : "Play (Space)"}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          className="inline-flex h-9 w-12 items-center justify-center rounded-lg bg-violet-500 text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <IconButton label="Step forward one frame (Right arrow)" onClick={() => step(FRAME_MS)} disabled={!ready}>
          <StepForward size={16} />
        </IconButton>
        <IconButton label="Restart" onClick={restart} disabled={!ready}>
          <RotateCcw size={16} />
        </IconButton>
      </div>

      <div className="font-mono text-sm tabular-nums text-zinc-200" aria-live="off">
        {formatMs(timeMs)}
        <span className="text-zinc-500"> / {formatMs(totalMs)}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Speed
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded-md border border-white/10 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setPickMode(!pickMode)}
          aria-pressed={pickMode}
          disabled={!ready}
          className={
            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 " +
            (pickMode
              ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
              : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white")
          }
        >
          <Crosshair size={15} />
          {pickMode ? "Click an element" : "Pick element"}
        </button>
      </div>
    </div>
  );
}
