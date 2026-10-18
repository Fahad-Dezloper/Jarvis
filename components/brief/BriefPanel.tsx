"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Cpu, FileText, Loader2, Wand2 } from "lucide-react";
import type { BriefInput, BriefOutput } from "@/lib/types";

export interface BriefActionsContext {
  input: BriefInput;
  output: BriefOutput;
}

export interface BriefPanelProps {
  /** Built fresh on each click so it reflects live code, narration and pins. */
  getInput: () => BriefInput;
  /** Disables the button and explains why. */
  blockedReason?: string | null;
  /** Slot for the send actions (copy to Cursor, Claude, MOTION_BRIEF.md ...). */
  actions?: (ctx: BriefActionsContext) => ReactNode;
}

type ApiBrief = BriefOutput & { note?: string };

export function BriefPanel({ getInput, blockedReason, actions }: BriefPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ input: BriefInput; output: ApiBrief } | null>(null);
  const [copied, setCopied] = useState(false);

  const build = async () => {
    setLoading(true);
    setError(null);
    try {
      const input = getInput();
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json().catch(() => null)) as (ApiBrief & { error?: string }) | null;
      if (!res.ok || !body || typeof body.prompt !== "string") {
        throw new Error(body?.error ?? `The brief request failed (${res.status}).`);
      }
      setResult({ input, output: body });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the brief.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.output.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard is blocked here. Select the prompt text and copy it manually.");
    }
  };

  const out = result?.output;

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <FileText className="size-4 text-[#5ee1c1]" />
          Brief
        </h2>
        <button
          type="button"
          onClick={build}
          disabled={loading || !!blockedReason}
          title={blockedReason ?? undefined}
          className="btn-primary"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          {loading ? "Building..." : out ? "Rebuild brief" : "Build brief"}
        </button>
      </div>
      {blockedReason && <p className="mt-2 text-[11px] text-zinc-500">{blockedReason}</p>}

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {out && result && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                out.source === "model" ? "bg-[#8b7cff]/20 text-[#c9c2ff]" : "bg-amber-300/15 text-amber-200"
              }`}
            >
              <Cpu className="size-3" />
              {out.source === "model" ? "Written by the model" : "Offline heuristic (no model used)"}
            </span>
            {out.note && <span className="text-amber-300/90">{out.note}</span>}
          </div>

          <p className="text-[13px] leading-relaxed text-zinc-300">{out.summary}</p>

          {out.issues.length > 0 && (
            <ol className="space-y-2">
              {out.issues.map((issue, i) => (
                <li key={i} className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5 text-xs leading-relaxed">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    {issue.timeMs !== null && (
                      <span className="font-mono tabular-nums text-amber-200">{Math.round(issue.timeMs)} ms</span>
                    )}
                    {issue.selector && <span className="truncate font-mono">{issue.selector}</span>}
                  </div>
                  <p className="text-zinc-200">{issue.problem}</p>
                  {issue.currentValues && (
                    <p className="mt-1 text-zinc-500">
                      <span className="text-zinc-400">Now:</span> {issue.currentValues}
                    </p>
                  )}
                  {issue.target && (
                    <p className="text-zinc-500">
                      <span className="text-zinc-400">Target:</span> {issue.target}
                    </p>
                  )}
                  {issue.suggestedChange && (
                    <p className="text-zinc-500">
                      <span className="text-zinc-400">Change:</span> {issue.suggestedChange}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Prompt</span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/20"
              >
                {copied ? <Check className="size-3 text-emerald-300" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              readOnly
              value={out.prompt}
              rows={10}
              aria-label="Generated prompt"
              className="block max-h-80 w-full resize-y rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300 outline-none"
            />
          </div>

          {actions?.({ input: result.input, output: out })}
        </div>
      )}
    </div>
  );
}
