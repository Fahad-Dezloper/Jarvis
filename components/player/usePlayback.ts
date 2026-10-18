"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlaybackController } from "@/lib/runtime/controller";
import type { AnimationInfo, DOMRectLike } from "@/lib/types";

/** Duration of one frame at 60fps, used by the frame-step controls. */
export const FRAME_MS = 1000 / 60;

export interface PickedElement {
  selector: string;
  tag: string;
  rect: DOMRectLike;
}

export interface Playback {
  ready: boolean;
  animations: AnimationInfo[];
  timeMs: number;
  totalMs: number;
  playing: boolean;
  rate: number;
  pickMode: boolean;
  picked: PickedElement | null;
  error: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (timeMs: number) => void;
  step: (deltaMs: number) => void;
  setRate: (rate: number) => void;
  restart: () => void;
  rescan: () => void;
  setPickMode: (enabled: boolean) => void;
}

/** Subscribe to a PlaybackController and expose state plus bound commands. */
export function usePlayback(controller: PlaybackController): Playback {
  const [ready, setReady] = useState(false);
  const [animations, setAnimations] = useState<AnimationInfo[]>([]);
  const [timeMs, setTimeMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [pickMode, setPickModeState] = useState(false);
  const [picked, setPicked] = useState<PickedElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return controller.subscribe((event) => {
      switch (event.type) {
        case "mb:ready":
          setReady(true);
          setError(null);
          break;
        case "mb:animations":
          setReady(true);
          setAnimations(event.animations);
          setTotalMs(event.totalMs);
          break;
        case "mb:time":
          setTimeMs(event.timeMs);
          setPlaying(event.playing);
          break;
        case "mb:element-picked":
          setPicked({ selector: event.selector, tag: event.tag, rect: event.rect });
          // One pick per activation: leave pick mode so the page is usable again.
          setPickModeState(false);
          controller.send({ type: "mb:pick-mode", enabled: false });
          break;
        case "mb:error":
          setError(event.message);
          break;
      }
    });
  }, [controller]);

  const play = useCallback(() => controller.send({ type: "mb:play" }), [controller]);
  const pause = useCallback(() => controller.send({ type: "mb:pause" }), [controller]);
  const seek = useCallback(
    (t: number) => controller.send({ type: "mb:seek", timeMs: t }),
    [controller],
  );
  const step = useCallback(
    (d: number) => controller.send({ type: "mb:step", deltaMs: d }),
    [controller],
  );
  const restart = useCallback(() => controller.send({ type: "mb:restart" }), [controller]);
  const rescan = useCallback(() => controller.send({ type: "mb:scan" }), [controller]);
  const setRate = useCallback(
    (r: number) => {
      setRateState(r);
      controller.send({ type: "mb:rate", rate: r });
    },
    [controller],
  );
  const setPickMode = useCallback(
    (enabled: boolean) => {
      setPickModeState(enabled);
      controller.send({ type: "mb:pick-mode", enabled });
    },
    [controller],
  );
  const toggle = useCallback(
    () => controller.send({ type: playing ? "mb:pause" : "mb:play" }),
    [controller, playing],
  );

  return useMemo(
    () => ({
      ready, animations, timeMs, totalMs, playing, rate, pickMode, picked, error,
      play, pause, toggle, seek, step, setRate, restart, rescan, setPickMode,
    }),
    [ready, animations, timeMs, totalMs, playing, rate, pickMode, picked, error,
      play, pause, toggle, seek, step, setRate, restart, rescan, setPickMode],
  );
}
