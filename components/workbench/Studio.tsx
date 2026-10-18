"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
  type SandpackPreviewRef,
} from "@codesandbox/sandpack-react";
import { ChevronLeft, ChevronRight, PlugZap, RefreshCw } from "lucide-react";
import { BriefPanel } from "@/components/brief/BriefPanel";
import { SendActions } from "@/components/send/SendActions";
import { NarrationPanel } from "@/components/narration/NarrationPanel";
import { PinList } from "@/components/narration/PinList";
import { useNarration } from "@/components/narration/useNarration";
import { Timeline } from "@/components/player/Timeline";
import { Transport } from "@/components/player/Transport";
import { usePlayback } from "@/components/player/usePlayback";
import { buildBriefInput } from "@/lib/brief/buildInput";
import { PlaybackController } from "@/lib/runtime/controller";
import type { SandboxProject } from "@/lib/sandbox/templates";

/** How long to wait for mb:ready before saying the runtime is not connected. */
const CONNECT_TIMEOUT_MS = 8000;

export interface StudioProps {
  project: SandboxProject;
  label: string;
  importPanel: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  dragging: boolean;
  onDragState: (dragging: boolean) => void;
  onDropFiles: (files: FileList) => void;
}

/**
 * Everything that lives inside one Sandpack session. It is keyed by the
 * import in Workbench, so a new import starts with a fresh controller, fresh
 * narration and no stale pins.
 */
export function Studio({
  project,
  label,
  importPanel,
  collapsed,
  onToggleCollapsed,
  dragging,
  onDragState,
  onDropFiles,
}: StudioProps) {
  const { sandpack } = useSandpack();
  const [controller] = useState(() => new PlaybackController());
  const playback = usePlayback(controller);
  const previewRef = useRef<SandpackPreviewRef>(null);
  const attachedRef = useRef<Window | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // The preview iframe can be created or replaced after mount, so follow it.
  const syncIframe = useCallback(() => {
    const win = previewRef.current?.getClient()?.iframe?.contentWindow ?? null;
    if (win && win !== attachedRef.current) {
      attachedRef.current = win;
      controller.attach(win);
    }
  }, [controller]);

  useEffect(() => {
    syncIframe();
    const id = setInterval(syncIframe, 300);
    return () => {
      clearInterval(id);
      attachedRef.current = null;
      controller.detach();
    };
  }, [controller, syncIframe]);

  useEffect(() => {
    if (playback.ready) return;
    const t = setTimeout(() => setTimedOut(true), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [playback.ready]);

  const reconnect = () => {
    setTimedOut(false);
    attachedRef.current = null;
    syncIframe();
    playback.rescan();
  };

  // A lane click chooses the element for the next pin until a new element is picked.
  const [laneSel, setLaneSel] = useState<{ selector: string; basis: unknown } | null>(null);
  const selector =
    laneSel && laneSel.basis === playback.picked ? laneSel.selector : (playback.picked?.selector ?? null);
  const narration = useNarration({
    timeMs: playback.timeMs,
    playing: playback.playing,
    animations: playback.animations,
    selector,
  });

  const sortedPins = useMemo(
    () => [...narration.pins].sort((a, b) => a.timeMs - b.timeMs),
    [narration.pins],
  );
  const markers = useMemo(
    () =>
      sortedPins.map((p) => ({
        id: p.id,
        timeMs: p.timeMs,
        label: `${Math.round(p.timeMs)} ms${p.text ? ": " + p.text.slice(0, 80) : ""}`,
      })),
    [sortedPins],
  );

  const getInput = () => {
    const files: Record<string, string> = {};
    for (const path of project.visibleFiles) {
      const f = sandpack.files[path];
      if (f) files[path] = f.code;
    }
    return buildBriefInput({
      componentName: label,
      files,
      animations: playback.animations,
      narration: narration.text,
      pins: narration.pins,
    });
  };

  const connected = playback.ready;
  const notConnected = !connected && timedOut;
  const blockedReason =
    !narration.text.trim() && narration.pins.length === 0
      ? "Narrate what you see, or pin a moment, to build a brief."
      : null;

  return (
    <div className="mb-sandpack flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* Left: import + editor */}
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Show import and editor"
          className="hidden w-9 shrink-0 flex-col items-center gap-3 border-r border-white/[0.07] bg-[#0f0f16] py-3 text-zinc-500 hover:text-zinc-200 lg:flex"
        >
          <ChevronRight className="size-4" />
          <span className="[writing-mode:vertical-rl] text-[11px] font-medium tracking-wide">
            Import and code
          </span>
        </button>
      ) : null}
      <section
        className={`relative min-h-0 shrink-0 flex-col border-white/[0.07] lg:w-[400px] lg:border-r xl:w-[440px] ${
          collapsed ? "hidden" : "flex"
        } ${dragging ? "bg-[#8b7cff]/5" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          onDragState(true);
        }}
        onDragLeave={() => onDragState(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragState(false);
          if (e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0f0f16] px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Source</span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse"
            aria-label="Collapse import and editor"
            className="hidden rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 lg:block"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        <div className="max-h-[48vh] shrink-0 overflow-y-auto border-b border-white/[0.07] bg-[#0f0f16] p-4">
          {importPanel}
        </div>
        <div className="min-h-[260px] flex-1">
          <SandpackCodeEditor showLineNumbers showTabs closableTabs={false} style={{ height: "100%" }} />
        </div>
      </section>

      {/* Centre: preview + transport + timeline */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#09090d] p-3 lg:p-4">
        <div className="relative h-[42vh] min-h-[280px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0b0b10] lg:h-[46vh]">
          <SandpackPreview
            ref={previewRef}
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton
            style={{ height: "100%" }}
          />
          {notConnected && (
            <div className="absolute inset-x-3 bottom-3 flex items-start gap-3 rounded-lg border border-amber-300/30 bg-[#1b1608]/95 p-3 text-xs text-amber-100 shadow-xl">
              <PlugZap className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <div className="flex-1">
                <p className="font-medium">Playback runtime not connected</p>
                <p className="mt-0.5 leading-relaxed text-amber-200/80">
                  The preview never reported in, so the timeline and scrubbing are unavailable. The preview
                  may still be loading, offline, or the code may have a build error.
                </p>
              </div>
              <button
                type="button"
                onClick={reconnect}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-300/20 px-2.5 py-1.5 font-medium text-amber-100 hover:bg-amber-300/30"
              >
                <RefreshCw className="size-3" /> Retry
              </button>
            </div>
          )}
        </div>
        {playback.error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">Runtime: {playback.error}</p>
        )}
        <Transport playback={playback} />
        <Timeline
          playback={playback}
          markers={markers}
          onSelectMarker={(m) => playback.seek(m.timeMs)}
          onSelectLane={(a) => {
            // Lanes only choose the element for the next pin; they never move the playhead.
            if (a.selector) setLaneSel({ selector: a.selector, basis: playback.picked });
          }}
        />
      </section>

      {/* Right: narration, pins, brief */}
      <aside className="flex min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-white/[0.07] bg-[#0c0c12] p-3 lg:w-[380px] lg:border-l lg:border-t-0 lg:p-4 xl:w-[420px]">
        <NarrationPanel narration={narration} timeMs={playback.timeMs} selector={selector} />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Pins</h2>
            <span className="text-[11px] text-zinc-500">{sortedPins.length}</span>
          </div>
          <PinList
            pins={sortedPins}
            timeMs={playback.timeMs}
            onSeek={playback.seek}
            onEdit={(id, text) => narration.updatePin(id, { text })}
            onDelete={narration.deletePin}
          />
        </div>
        <BriefPanel
          getInput={getInput}
          blockedReason={blockedReason}
          actions={({ input, output }) => (
            <SendActions brief={output} componentName={input.componentName} />
          )}
        />
      </aside>
    </div>
  );
}
