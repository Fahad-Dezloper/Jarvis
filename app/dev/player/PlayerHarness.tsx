"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlaybackController } from "@/lib/runtime/controller";
import { escapeScriptText } from "@/lib/runtime/pure";
import { RUNTIME_SOURCE } from "@/lib/runtime/runtime.source";
import { Timeline } from "@/components/player/Timeline";
import { Transport } from "@/components/player/Transport";
import { usePlayback } from "@/components/player/usePlayback";

const DEMO_STYLES = `
  html,body{margin:0;height:100%;background:#0b0b10;color:#e4e4e7;font:14px system-ui,sans-serif}
  .stage{display:grid;gap:28px;padding:28px}
  .row{display:flex;align-items:center;gap:16px}
  .tag{width:90px;font:12px ui-monospace,monospace;color:#a1a1aa}
  .box{width:56px;height:56px;border-radius:12px}
  .css-box{background:#38bdf8;animation:pulse 1.6s ease-in-out infinite}
  .waapi-box{background:#34d399}
  .gsap-box{background:#a3e635}
  @keyframes pulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.4}100%{transform:scale(1);opacity:1}}
`;

const DEMO_BODY = `
  <div class="stage">
    <div class="row"><span class="tag">CSS keyframes</span><div class="box css-box" id="css-demo"></div></div>
    <div class="row"><span class="tag">WAAPI</span><div class="box waapi-box" id="waapi-demo"></div></div>
    <div class="row"><span class="tag">GSAP</span><div class="box gsap-box" id="gsap-demo"></div></div>
  </div>
`;

const DEMO_SCRIPT = `
  document.getElementById('waapi-demo').animate(
    [{ transform: 'translateX(0)', opacity: 0.3 }, { transform: 'translateX(220px)', opacity: 1 }],
    { duration: 1800, delay: 200, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }
  );
  if (window.gsap) {
    var tl = window.gsap.timeline();
    tl.to('#gsap-demo', { x: 220, duration: 1.2, ease: 'power2.inOut' })
      .to('#gsap-demo', { rotation: 180, borderRadius: '50%', duration: 0.8, ease: 'back.out(1.7)' });
  }
`;

function buildSrcDoc(gsapSource: string): string {
  return (
    "<!doctype html><html><head><meta charset='utf-8'><style>" + DEMO_STYLES + "</style></head><body>" +
    DEMO_BODY +
    "<script>" + escapeScriptText(gsapSource) + "</script>" +
    "<script>" + DEMO_SCRIPT + "</script>" +
    // The runtime goes last so it sees every animation the demo created.
    "<script>" + escapeScriptText(RUNTIME_SOURCE) + "</script>" +
    "</body></html>"
  );
}

export function PlayerHarness({ gsapSource }: { gsapSource: string }) {
  const [controller] = useState(() => new PlaybackController());
  const playback = usePlayback(controller);
  const srcDoc = useMemo(() => buildSrcDoc(gsapSource), [gsapSource]);

  const frameRef = useRef<HTMLIFrameElement>(null);

  // Attach as early as possible (covers a load that finishes before hydration),
  // and again on load, which also asks the runtime to rescan.
  useEffect(() => {
    controller.attach(frameRef.current?.contentWindow ?? null);
    return () => controller.detach();
  }, [controller]);

  const onLoad = useCallback(
    (e: React.SyntheticEvent<HTMLIFrameElement>) => {
      controller.attach(e.currentTarget.contentWindow);
    },
    [controller],
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <h1 className="text-xl font-semibold">Player dev harness</h1>
          <p className="mt-1 text-sm text-zinc-400">
            This is a dev harness for the playback engine, not a product screen. It runs the runtime inside a
            plain sandboxed iframe (no Sandpack) with CSS, WAAPI and GSAP demo animations.
            Keys: Space plays or pauses, Left and Right arrows step one frame (Shift for ten).
          </p>
        </header>

        <iframe
          ref={frameRef}
          title="Animation preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          onLoad={onLoad}
          className="h-[280px] w-full rounded-xl border border-white/10 bg-black"
        />

        <Transport playback={playback} />
        <Timeline playback={playback} />

        <section className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Picked element</h2>
            {playback.picked ? (
              <p className="font-mono text-xs text-violet-300">
                {playback.picked.selector}{" "}
                <span className="text-zinc-500">
                  ({Math.round(playback.picked.rect.width)} x {Math.round(playback.picked.rect.height)})
                </span>
              </p>
            ) : (
              <p className="text-zinc-500">Nothing picked yet.</p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Runtime status</h2>
            <p className={playback.error ? "text-red-300" : "text-zinc-400"}>
              {playback.error ?? (playback.ready ? "Connected." : "Waiting for runtime...")}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
