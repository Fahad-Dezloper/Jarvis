"use client";

import { Crosshair, Trash2 } from "lucide-react";
import { formatPinTime } from "@/lib/narration/pure";
import type { Pin } from "@/lib/types";

export interface PinListProps {
  pins: Pin[];
  timeMs: number;
  onSeek: (timeMs: number) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export function PinList({ pins, timeMs, onSeek, onEdit, onDelete }: PinListProps) {
  if (pins.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs leading-relaxed text-zinc-500">
        No pins yet. Finish a sentence, pause or scrub the player after typing, or press
        &quot;Pin this moment&quot;.
      </p>
    );
  }
  const sorted = [...pins].sort((a, b) => a.timeMs - b.timeMs);
  return (
    <ul className="space-y-2">
      {sorted.map((p, i) => {
        const at = Math.abs(p.timeMs - timeMs) < 16;
        return (
          <li
            key={p.id}
            className={`rounded-lg border p-2.5 transition ${
              at ? "border-amber-300/50 bg-amber-300/[0.06]" : "border-white/[0.07] bg-white/[0.02]"
            }`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-amber-300 text-[10px] font-bold text-[#0b0b10]">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onSeek(p.timeMs)}
                title="Seek the player to this pin"
                className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-amber-200 hover:bg-white/15"
              >
                {formatPinTime(p.timeMs)}
              </button>
              {p.selector && (
                <span className="flex min-w-0 items-center gap-1 text-[11px] text-zinc-500" title={p.selector}>
                  <Crosshair className="size-3 shrink-0" />
                  <span className="truncate font-mono">{p.selector}</span>
                </span>
              )}
              <span className="ml-auto shrink-0 text-[10px] text-zinc-600">
                {p.measured?.length ?? 0} active
              </span>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                aria-label="Delete pin"
                title="Delete pin"
                className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-red-300"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <textarea
              value={p.text}
              onChange={(e) => onEdit(p.id, e.target.value)}
              rows={Math.min(4, Math.max(1, Math.ceil(p.text.length / 44)))}
              placeholder="Describe this moment"
              className="w-full resize-none rounded-md bg-black/25 px-2 py-1.5 text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-[#8b7cff]/60"
            />
          </li>
        );
      })}
    </ul>
  );
}
