"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Square } from "lucide-react";
import { formatClock, pickMimeType } from "@/lib/recorder/pure";
import type { RecordedClip } from "@/lib/recorder/types";

// Region Capture is not in lib.dom.d.ts. Chromium-only; always feature-detect.
interface CropTargetStatic {
  fromElement(el: Element): Promise<unknown>;
}
type CroppableTrack = MediaStreamTrack & { cropTo?: (target: unknown) => Promise<void> };

function getCropTarget(): CropTargetStatic | null {
  const ct = (globalThis as { CropTarget?: CropTargetStatic }).CropTarget;
  return ct && typeof ct.fromElement === "function" ? ct : null;
}

export interface ScreenRecorderProps {
  onRecorded(clip: RecordedClip): void;
  /**
   * CSS selector of the element to crop to when "Record only this region" is
   * ticked (Region Capture, Chromium only). The option is hidden when the
   * browser lacks the API or the selector is not given.
   */
  cropSelector?: string;
  className?: string;
}

type Phase = "idle" | "starting" | "recording";

export function ScreenRecorder({ onRecorded, cropSelector, className = "" }: ScreenRecorderProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cropOn, setCropOn] = useState(false);
  const [support, setSupport] = useState<{ display: boolean; recorder: boolean; crop: boolean } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  // Feature detection must run on the client, after hydration.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setSupport({
        display: !!navigator.mediaDevices?.getDisplayMedia,
        recorder: typeof MediaRecorder !== "undefined",
        crop: getCropTarget() !== null,
      }),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const releaseStream = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Stop everything if the component unmounts mid-recording (discard the data).
  useEffect(
    () => () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      recorderRef.current = null;
      releaseStream();
    },
    [releaseStream],
  );

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else releaseStream();
  }, [releaseStream]);

  const start = useCallback(
    async (currentTab: boolean) => {
      setError(null);
      const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
      if (!mimeType) {
        setError("This browser's MediaRecorder supports none of the video formats we try (webm/mp4).");
        return;
      }
      setPhase("starting");
      try {
        // preferCurrentTab is a Chromium hint, not in the TS types; other browsers ignore it.
        const constraints = { video: { frameRate: 30 }, audio: false, preferCurrentTab: currentTab };
        const stream = await navigator.mediaDevices.getDisplayMedia(constraints as DisplayMediaStreamOptions);
        streamRef.current = stream;
        const [track] = stream.getVideoTracks();

        if (cropOn && cropSelector) {
          const CT = getCropTarget();
          const el = document.querySelector(cropSelector);
          if (!CT || !el) throw new Error(`Region capture: no element matches "${cropSelector}".`);
          const target = await CT.fromElement(el);
          const cropTo = (track as CroppableTrack).cropTo;
          if (!cropTo) throw new Error("Region capture is unavailable on this track.");
          // Rejects unless the user chose THIS tab in the picker.
          await cropTo.call(track, target);
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onerror = () => setError("The recorder reported an error and stopped.");
        recorder.onstop = () => {
          const durationMs = performance.now() - startedAtRef.current;
          const type = recorder.mimeType || mimeType;
          const blob = new Blob(chunksRef.current, { type });
          chunksRef.current = [];
          recorderRef.current = null;
          releaseStream();
          setPhase("idle");
          if (blob.size > 0) onRecordedRef.current({ blob, mimeType: type, durationMs });
          else setError("Nothing was recorded.");
        };
        // The browser's own "Stop sharing" button ends the track; treat it as Stop.
        track.addEventListener("ended", () => {
          if (recorder.state !== "inactive") recorder.stop();
        });

        startedAtRef.current = performance.now();
        setElapsedMs(0);
        recorder.start(1000);
        timerRef.current = window.setInterval(
          () => setElapsedMs(performance.now() - startedAtRef.current),
          250,
        );
        setPhase("recording");
      } catch (err) {
        releaseStream();
        recorderRef.current = null;
        setPhase("idle");
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Screen capture was cancelled or blocked."
            : err instanceof Error
              ? err.message
              : "Could not start recording.",
        );
      }
    },
    [cropOn, cropSelector, releaseStream],
  );

  const unsupported = support !== null && (!support.display || !support.recorder);
  const showCrop = !!support?.crop && !!cropSelector;

  return (
    <div className={"rounded-xl border border-white/10 bg-zinc-900/80 p-3 " + className}>
      <div className="flex flex-wrap items-center gap-2">
        {phase === "recording" ? (
          <>
            <button type="button" onClick={stop} className="btn-primary" style={{ background: "#f87171" }}>
              <Square className="h-3 w-3" aria-hidden /> Stop
            </button>
            <span
              role="timer"
              aria-label="Recording duration"
              className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-red-300"
            >
              <Circle className="h-2.5 w-2.5 animate-pulse fill-red-400 text-red-400" aria-hidden />
              {formatClock(elapsedMs)}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={phase === "starting" || unsupported}
              onClick={() => void start(true)}
            >
              <Circle className="h-3 w-3" aria-hidden /> Record this tab
            </button>
            <button
              type="button"
              disabled={phase === "starting" || unsupported}
              onClick={() => void start(false)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
            >
              Choose window or screen
            </button>
          </>
        )}
      </div>

      {showCrop && phase !== "recording" && (
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={cropOn} onChange={(e) => setCropOn(e.target.checked)} />
          Record only the preview region (Region Capture; Chromium only, and you must pick this tab)
        </label>
      )}
      {support && !support.crop && cropSelector && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Region capture is not available in this browser (Chromium only), so the whole tab or window is recorded.
        </p>
      )}

      {unsupported && (
        <p role="alert" className="mt-2 text-xs text-amber-300">
          This browser cannot record the screen ({!support?.display ? "getDisplayMedia" : "MediaRecorder"} missing).
          Record with your OS tool and drop the file into the annotator instead.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Recorded WebM files usually have no duration in their header. The annotator repairs this when loading, but
        seeking in a very long recording may be slow the first time.
      </p>
    </div>
  );
}
