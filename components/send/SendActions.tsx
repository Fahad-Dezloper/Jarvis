"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, MousePointer2, Terminal, Globe } from "lucide-react";
import type { BriefOutput } from "@/lib/types";
import {
  claudeCliCommand,
  claudeCodeDeeplink,
  claudeWebLink,
  cursorDeeplink,
  shortPromptReferencingFile,
  CLAUDE_CODE_Q_LIMIT,
  CURSOR_URL_LIMIT,
} from "@/lib/send/links";
import { buildBriefMarkdown, safeBriefFileName } from "@/lib/send/markdown";

interface Props {
  brief: BriefOutput;
  componentName: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400";
const btnPrimary = btn.replace("bg-white/5", "bg-violet-600").replace("hover:bg-white/10", "hover:bg-violet-500").replace("border-white/10", "border-violet-500/50");

export function SendActions({ brief, componentName }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileName = safeBriefFileName(componentName);
  const shortPrompt = shortPromptReferencingFile(fileName);
  const cursor = useMemo(() => cursorDeeplink(brief.prompt), [brief.prompt]);
  const claudeCode = useMemo(() => claudeCodeDeeplink(brief.prompt), [brief.prompt]);
  const cursorShort = useMemo(() => cursorDeeplink(shortPrompt), [shortPrompt]);
  const claudeCodeShort = useMemo(() => claudeCodeDeeplink(shortPrompt), [shortPrompt]);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 3500);
  }, []);

  const copy = useCallback(
    async (text: string, label: string) => {
      flash((await copyText(text)) ? `${label} copied` : "Copy failed: select the text manually");
    },
    [flash],
  );

  const download = useCallback(() => {
    const md = buildBriefMarkdown(brief, { componentName });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash(`Downloaded ${fileName}`);
  }, [brief, componentName, fileName, flash]);

  const openCursor = () => {
    if (cursor.fits) {
      window.location.href = cursor.app;
      flash("Opening Cursor with the full prompt");
    } else {
      window.location.href = cursorShort.app;
      download();
      flash(`Prompt too long for a link: opened Cursor with a short prompt. Put ${fileName} in your repo root.`);
    }
  };

  const openClaudeCode = () => {
    if (claudeCode.fits) {
      window.location.href = claudeCode.url;
      flash("Opening Claude Code with the full prompt");
    } else {
      window.location.href = claudeCodeShort.url;
      download();
      flash(`Prompt too long for a link: opened Claude Code with a short prompt. Put ${fileName} in your repo root.`);
    }
  };

  const cliCommand = claudeCliCommand(brief.prompt);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 text-zinc-100">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={() => copy(brief.prompt, "Prompt")}>
          <Copy size={16} aria-hidden /> Copy prompt
        </button>
        <button type="button" className={btn} onClick={openCursor}>
          <MousePointer2 size={16} aria-hidden /> Open in Cursor
        </button>
        <button
          type="button"
          className={btn}
          onClick={openClaudeCode}
          title="Needs Claude Code to have been used once on this machine (it registers the claude-cli:// handler on your first prompt)."
        >
          <Terminal size={16} aria-hidden /> Open in Claude Code
        </button>
        <a
          className={btn}
          href={claudeWebLink(brief.prompt)}
          target="_blank"
          rel="noopener noreferrer"
          title="Best effort: claude.ai may ignore the prefilled text."
        >
          <Globe size={16} aria-hidden /> Open in Claude (web) <ExternalLink size={12} aria-hidden />
        </a>
        <button type="button" className={btn} onClick={download}>
          <Download size={16} aria-hidden /> Download {fileName}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="max-w-full truncate rounded bg-black/40 px-2 py-1 font-mono text-xs text-zinc-400" title="Command-line alternative">
          {cliCommand.length > 90 ? `${cliCommand.slice(0, 90)}…` : cliCommand}
        </code>
        <button type="button" className={`${btn} !px-2 !py-1 text-xs`} onClick={() => copy(cliCommand, "Command")}>
          <Copy size={12} aria-hidden /> Copy claude command
        </button>
      </div>

      <div className="mt-3 space-y-1 text-xs text-zinc-400" aria-live="polite">
        <p className="min-h-4 text-emerald-400">
          {status && (
            <span className="inline-flex items-center gap-1">
              <Check size={12} aria-hidden /> {status}
            </span>
          )}
        </p>
        <p>
          Cursor links hold about {CURSOR_URL_LIMIT.toLocaleString()} characters (docs say 10,000; we stay under). This prompt: {cursor.encodedLength.toLocaleString()}
          {cursor.fits ? " (fits)." : ". Too long, so the button sends a short prompt pointing to the downloaded file."}
        </p>
        <p>
          Claude Code links cap the prompt at {CLAUDE_CODE_Q_LIMIT.toLocaleString()} characters. This prompt: {claudeCode.qLength.toLocaleString()} encoded
          {claudeCode.fits ? " (fits)." : ". Too long, so the button sends a short prompt pointing to the downloaded file."}
        </p>
        <p>Links only prefill the prompt; nothing runs until you press Enter. Opening Claude on the web is best effort.</p>
      </div>
    </div>
  );
}
