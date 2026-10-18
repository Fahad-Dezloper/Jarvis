"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, FileVideo, Pause, Play, SkipBack, SkipForward, Trash2, X } from "lucide-react";
import type { Pin } from "@/lib/types";
import { repairInfiniteDuration } from "@/lib/recorder/media";
import {
  DEFAULT_FPS,
  PLAYBACK_RATES,
  clamp,
  containBox,
  describeMark,
  estimateFps,
  extensionForMime,
  formatTime,
  frameSeekSeconds,
  frameToTimeMs,
  isAcceptedVideoFile,
  parseMark,
  pointToMark,
  sortPins,
  stepFrame,
  stripMark,
  timeToFrame,
  withMark,
} from "@/lib/recorder/pure";
import type { FrameSample, PinMark, RecordedClip } from "@/lib/recorder/types";
import { ScreenRecorder } from "./ScreenRecorder";

export interface VideoAnnotatorProps {
  pins: Pin[];
  onPinsChange(pins: Pin[]): void;
  /** Called with a one-line description whenever a pin is created. */
  onNarrationAppend?(text: string): void;
  /** Selector forwarded to the recorder for optional Region Capture. */
  cropSelector?: string;
}

interface Source {
  url: string;
  name: string;
  knownDurationMs: number | null;
}

type FpsSource = "assumed" | "estimated" | "manual";

function newPinId(): string {
  return `vp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function VideoAnnotator({ pins, onPinsChange, onNarrationAppend, cropSelector }: VideoAnnotatorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const samplesRef = useRef<FrameSample[]>([]);
  const repairingRef = useRef(false);
  const fpsLockedRef = useRef(false);

  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const [mediaTime, setMediaTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [fpsSource, setFpsSource] = useState<FpsSource>("assumed");
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [hasRvfc, setHasRvfc] = useState(true);

  const [draftText, setDraftText] = useState("");
  const [draftMark, setDraftMark] = useState<PinMark | null>(null);

  // ---- source management (object URLs are revoked when replaced / unmounted) ----
  const setSourceFromBlob = useCallback((blob: Blob, name: string, knownDurationMs: number | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    samplesRef.current = [];
    fpsLockedRef.current = false;
    setFps(DEFAULT_FPS);
    setFpsSource("assumed");
    setMediaTime(0);
    setDuration(0);
    setPlaying(false);
    setError(null);
    setDraftMark(null);
    setSource({ url, name, knownDurationMs });
  }, []);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    [],
  );

  const loadFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!isAcceptedVideoFile(file.name, file.type)) {
        setError(`"${file.name}" is not an mp4, webm or mov video.`);
        return;
      }
      setShowRecorder(false);
      setSourceFromBlob(file, file.name, null);
    },
    [setSourceFromBlob],
  );

  const onRecorded = useCallback(
    (clip: RecordedClip) => {
      setShowRecorder(false);
      setSourceFromBlob(clip.blob, `recording.${extensionForMime(clip.mimeType)}`, clip.durationMs);
    },
    [setSourceFromBlob],
  );

  // ---- frame tracking ----
  useEffect(() => {
    const video = videoRef.current;
    if (!source || !video) return;
    if (typeof video.requestVideoFrameCallback !== "function") {
      const id = requestAnimationFrame(() => setHasRvfc(false));
      return () => cancelAnimationFrame(id);
    }
    let handle = 0;
    let cancelled = false;
    const onFrame: VideoFrameRequestCallback = (_now, meta) => {
      if (cancelled) return;
      if (!repairingRef.current) {
        setMediaTime(meta.mediaTime);
        const samples = samplesRef.current;
        samples.push({ mediaTime: meta.mediaTime, presentedFrames: meta.presentedFrames });
        if (samples.length > 90) samples.splice(0, samples.length - 90);
        if (!fpsLockedRef.current && samples.length >= 12 && samples.length % 6 === 0) {
          const est = estimateFps(samples);
          if (est) {
            setFps(est);
            setFpsSource("estimated");
          }
        }
      }
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    return () => {
      cancelled = true;
      video.cancelVideoFrameCallback?.(handle);
    };
  }, [source]);

  // Fallback clock when requestVideoFrameCallback is missing (time-resolution only, not frame-exact).
  useEffect(() => {
    const video = videoRef.current;
    if (!source || !video || hasRvfc || !playing) return;
    let raf = 0;
    const tick = () => {
      setMediaTime(video.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source, hasRvfc, playing]);

  // Track stage size so mark dots follow the letterboxed picture.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !source) return;
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [source]);

  // ---- derived ----
  const effectiveDuration = Number.isFinite(duration) && duration > 0 ? duration : (source?.knownDurationMs ?? 0) / 1000;
  const totalFrames = Math.max(1, Math.round(effectiveDuration * fps));
  const currentFrame = Math.min(timeToFrame(mediaTime * 1000, fps), totalFrames - 1);
  const currentMs = Math.round(frameToTimeMs(currentFrame, fps));
  const sortedPins = useMemo(() => sortPins(pins), [pins]);
  const box = containBox(stageSize.w, stageSize.h, videoSize.w, videoSize.h);
  const marksHere = sortedPins.filter((p) => timeToFrame(p.timeMs, fps) === currentFrame && parseMark(p.text));

  // ---- transport ----
  const seekSeconds = useCallback(
    (s: number) => {
      const video = videoRef.current;
      if (!video) return;
      const t = clamp(s, 0, effectiveDuration > 0 ? effectiveDuration : s);
      video.currentTime = t;
      setMediaTime(t);
    },
    [effectiveDuration],
  );

  const stepBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      const target = stepFrame(currentFrame, delta, totalFrames - 1);
      seekSeconds(frameSeekSeconds(target, fps));
    },
    [currentFrame, totalFrames, fps, seekSeconds],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (effectiveDuration > 0 && video.currentTime >= effectiveDuration - 0.01) video.currentTime = 0;
      void video.play().catch(() => setError("The browser blocked playback."));
    } else video.pause();
  }, [effectiveDuration]);

  const changeRate = (r: number) => {
    setRate(r);
    const video = videoRef.current;
    if (video) {
      video.defaultPlaybackRate = r;
      video.playbackRate = r;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!source) return;
    const t = e.target as HTMLElement;
    if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (t instanceof HTMLInputElement && t.type !== "range") return;
    const n = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepBy(n);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepBy(-n);
    } else if (e.key === " " && !(t instanceof HTMLButtonElement)) {
      e.preventDefault();
      togglePlay();
    }
  };

  // ---- pins ----
  const pinThisFrame = () => {
    const text = draftText.trim();
    if (!text && !draftMark) return;
    const pin: Pin = { id: newPinId(), timeMs: currentMs, selector: null, text: withMark(text, draftMark) };
    onPinsChange([...pins, pin]);
    const note = `At ${formatTime(currentMs)}${draftMark ? ` (${describeMark(draftMark)})` : ""}: ${text || "see marked point"}`;
    onNarrationAppend?.(note);
    setDraftText("");
    setDraftMark(null);
  };

  const updatePin = (id: string, patch: Partial<Pin>) =>
    onPinsChange(pins.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const deletePin = (id: string) => onPinsChange(pins.filter((p) => p.id !== id));

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const m = pointToMark(e.clientX - rect.left, e.clientY - rect.top, box);
    if (m) setDraftMark(m);
  };

  const dot = (m: PinMark, key: string, cls: string) => (
    <span
      key={key}
      className={"pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 " + cls}
      style={{ left: box.left + m.x * box.width, top: box.top + m.y * box.height }}
    />
  );

  // ---- render ----
  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3 outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
      aria-label="Video annotator. Space plays or pauses, arrow keys step one frame, shift plus arrows step ten."
    >
      {!source ? (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              loadFile(e.dataTransfer.files[0]);
            }}
            className={
              "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center " +
              (dragOver ? "border-violet-400 bg-violet-500/10" : "border-white/15")
            }
          >
            <FileVideo className="h-6 w-6 text-zinc-400" aria-hidden />
            <p className="text-sm text-zinc-300">Drop a screen recording here (mp4, webm, mov)</p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                Browse files
              </button>
              <button
                type="button"
                onClick={() => setShowRecorder((v) => !v)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5"
              >
                {showRecorder ? "Hide recorder" : "Record screen"}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
              className="hidden"
              onChange={(e) => {
                loadFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {showRecorder && <ScreenRecorder onRecorded={onRecorded} cropSelector={cropSelector} />}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
            <span className="truncate" title={source.name}>
              {source.name}
            </span>
            <button
              type="button"
              onClick={() => {
                videoRef.current?.pause();
                setSource(null);
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
              }}
              className="rounded border border-white/15 px-2 py-1 hover:bg-white/5"
            >
              Change video
            </button>
          </div>

          <div
            ref={stageRef}
            onClick={onStageClick}
            className="relative aspect-video w-full cursor-crosshair overflow-hidden rounded-lg bg-black"
          >
            <video
              ref={videoRef}
              src={source.url}
              muted
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-contain"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                setVideoSize({ w: v.videoWidth, h: v.videoHeight });
                v.defaultPlaybackRate = rate;
                v.playbackRate = rate;
                setStageSize({ w: stageRef.current?.clientWidth ?? 0, h: stageRef.current?.clientHeight ?? 0 });
                if (Number.isFinite(v.duration)) setDuration(v.duration);
                else {
                  repairingRef.current = true;
                  setRepairing(true);
                  void repairInfiniteDuration(v).then(() => {
                    repairingRef.current = false;
                    setRepairing(false);
                    if (Number.isFinite(v.duration)) setDuration(v.duration);
                    setMediaTime(0);
                  });
                }
              }}
              onDurationChange={(e) => {
                if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onSeeked={(e) => {
                if (!repairingRef.current) setMediaTime(e.currentTarget.currentTime);
              }}
              onError={() =>
                setError(
                  "This browser cannot decode the video (a .mov may use a codec Chrome/Firefox cannot play). Try an mp4 (H.264) or webm.",
                )
              }
            />
            {draftMark && dot(draftMark, "draft", "border-violet-300 bg-violet-400/40")}
            {marksHere.map((p) => dot(parseMark(p.text)!, p.id, "border-amber-300 bg-amber-400/40"))}
            {repairing && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 text-xs text-zinc-200">
                Reading recording length...
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}

          {/* scrubber */}
          <div>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(effectiveDuration * 1000))}
              step={1}
              value={Math.round(mediaTime * 1000)}
              disabled={effectiveDuration <= 0}
              onChange={(e) => {
                videoRef.current?.pause();
                seekSeconds(Number(e.target.value) / 1000);
              }}
              aria-label="Scrub video"
              aria-valuetext={formatTime(currentMs)}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500 disabled:opacity-40"
            />
            <div className="relative mt-1 h-4">
              {effectiveDuration > 0 &&
                sortedPins.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={`${formatTime(p.timeMs)}: ${stripMark(p.text)}`}
                    aria-label={`Pin at ${formatTime(p.timeMs)}`}
                    onClick={() => {
                      videoRef.current?.pause();
                      seekSeconds(frameSeekSeconds(timeToFrame(p.timeMs, fps), fps));
                    }}
                    className="absolute top-0 h-4 w-2 -translate-x-1/2 rounded-sm bg-amber-400/90 hover:bg-amber-300"
                    style={{ left: `${clamp((p.timeMs / 1000 / effectiveDuration) * 100, 0, 100)}%` }}
                  />
                ))}
            </div>
            <div className="flex justify-between font-mono text-[11px] tabular-nums text-zinc-500">
              <span>0:00.000</span>
              <span className="text-violet-300">
                {formatTime(currentMs)} &middot; frame {currentFrame + 1}/{totalFrames}
              </span>
              <span>{formatTime(effectiveDuration * 1000)}</span>
            </div>
          </div>

          {/* transport */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Previous frame" onClick={() => stepBy(-1)} className="rounded-lg border border-white/15 p-1.5 hover:bg-white/5">
              <SkipBack className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay} className="btn-primary">
              {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
              {playing ? "Pause" : "Play"}
            </button>
            <button type="button" aria-label="Next frame" onClick={() => stepBy(1)} className="rounded-lg border border-white/15 p-1.5 hover:bg-white/5">
              <SkipForward className="h-4 w-4" aria-hidden />
            </button>
            <label className="ml-2 flex items-center gap-1 text-xs text-zinc-400">
              Speed
              <select
                value={rate}
                onChange={(e) => changeRate(Number(e.target.value))}
                className="rounded border border-white/15 bg-zinc-900 px-1 py-0.5 text-zinc-200"
              >
                {PLAYBACK_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}x
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs text-zinc-400" title={`fps ${fpsSource}`}>
              fps
              <input
                type="number"
                min={1}
                max={240}
                step={0.001}
                value={fps}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= 240) {
                    fpsLockedRef.current = true;
                    setFps(v);
                    setFpsSource("manual");
                  }
                }}
                className="w-16 rounded border border-white/15 bg-zinc-900 px-1 py-0.5 text-zinc-200"
              />
              <span className="text-zinc-500">({fpsSource})</span>
            </label>
          </div>
          {!hasRvfc && (
            <p className="text-[11px] text-amber-300">
              This browser lacks requestVideoFrameCallback: stepping assumes the fps above and may be off by a frame.
            </p>
          )}

          {/* pin flow */}
          <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900/70 p-2">
            <p className="text-[11px] text-zinc-500">
              Click the picture to mark a point (optional), describe what is wrong on this frame, then pin it.
            </p>
            <div className="flex gap-2">
              <input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    pinThisFrame();
                  }
                }}
                placeholder={`Note for ${formatTime(currentMs)}...`}
                className="min-w-0 flex-1 rounded border border-white/15 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
              {draftMark && (
                <button type="button" onClick={() => setDraftMark(null)} className="rounded border border-white/15 px-2 text-xs text-zinc-300 hover:bg-white/5">
                  Clear mark
                </button>
              )}
              <button type="button" onClick={pinThisFrame} disabled={!draftText.trim() && !draftMark} className="btn-primary">
                <Circle className="h-3 w-3" aria-hidden /> Pin this frame
              </button>
            </div>
          </div>
        </>
      )}

      {/* pin list */}
      {sortedPins.length > 0 && (
        <ul className="space-y-1.5" aria-label="Pins">
          {sortedPins.map((p) => (
            <PinRow
              key={p.id}
              pin={p}
              onSeek={() => {
                videoRef.current?.pause();
                seekSeconds(frameSeekSeconds(timeToFrame(p.timeMs, fps), fps));
              }}
              canSeek={!!source}
              onText={(text) => updatePin(p.id, { text: withMark(text, parseMark(p.text)) })}
              onClearMark={() => updatePin(p.id, { text: withMark(p.text, null) })}
              onDelete={() => deletePin(p.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PinRow({
  pin,
  canSeek,
  onSeek,
  onText,
  onClearMark,
  onDelete,
}: {
  pin: Pin;
  canSeek: boolean;
  onSeek(): void;
  onText(text: string): void;
  onClearMark(): void;
  onDelete(): void;
}) {
  const mark = parseMark(pin.text);
  const shown = stripMark(pin.text);
  // Local draft so trailing spaces survive while typing; committed on blur / Enter.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== shown) onText(draft);
    setDraft(null);
  };
  return (
    <li className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/70 px-2 py-1.5">
      <button
        type="button"
        onClick={onSeek}
        disabled={!canSeek}
        className="shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-amber-200 hover:bg-amber-400/25 disabled:opacity-60"
      >
        {formatTime(pin.timeMs)}
      </button>
      <input
        value={draft ?? shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(null);
        }}
        aria-label={`Note for pin at ${formatTime(pin.timeMs)}`}
        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-zinc-100 hover:border-white/15 focus:border-violet-400 focus:outline-none"
      />
      {mark && (
        <button
          type="button"
          onClick={onClearMark}
          title="Remove marked point"
          className="flex shrink-0 items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-200 hover:bg-violet-500/25"
        >
          {Math.round(mark.x * 100)},{Math.round(mark.y * 100)}% <X className="h-3 w-3" aria-hidden />
        </button>
      )}
      <button type="button" onClick={onDelete} aria-label="Delete pin" className="shrink-0 text-zinc-500 hover:text-red-300">
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
