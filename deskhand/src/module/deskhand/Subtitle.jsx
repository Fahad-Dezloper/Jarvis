import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import useJarvisStore from "./store";
import { deriveSubtitle, resultDuration } from "./subtitleLogic";

export default function Subtitle() {
  const live = useJarvisStore((s) => s.live);
  const status = useJarvisStore((s) => s.status);
  const command = useJarvisStore((s) => s.command);
  const reply = useJarvisStore((s) => s.reply);
  const error = useJarvisStore((s) => s.error);
  const cancelled = useJarvisStore((s) => s.cancelled);
  const ok = useJarvisStore((s) => s.ok);
  const source = useJarvisStore((s) => s.source);
  const resultSeq = useJarvisStore((s) => s.resultSeq);
  const captureFocused = useJarvisStore((s) => s.captureFocused);
  const cancel = useJarvisStore((s) => s.cancel);

  const [showResult, setShowResult] = useState(false);
  const [ready, setReady] = useState(false);
  const [held, setHeld] = useState(null); // last visible content, kept so the fade-out has text

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!resultSeq) return undefined;
    const st = useJarvisStore.getState();
    const isErr = !!st.error || st.cancelled || !st.ok;
    setShowResult(true);
    const t = setTimeout(() => setShowResult(false), resultDuration(st.error || st.reply, isErr));
    return () => clearTimeout(t);
  }, [resultSeq]);

  const view = deriveSubtitle({
    live,
    status,
    command,
    reply,
    error,
    cancelled,
    ok,
    source,
    showResult,
    listening: ready && captureFocused,
  });

  const heldKey = `${view.kind}|${view.text}|${view.badge?.text ?? ""}`;
  const lastKey = useRef("");
  useEffect(() => {
    if (view.kind === "none" || view.kind === "listening") return;
    if (lastKey.current === heldKey) return;
    lastKey.current = heldKey;
    setHeld(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldKey]);

  const bubbleVisible = view.kind !== "none" && view.kind !== "listening";
  const shown = bubbleVisible ? view : held;

  return (
    <>
      <div className="dk-sub-wrap">
        <div
          className={`dk-ui dk-sub ${bubbleVisible ? "is-visible" : ""} is-${shown?.kind ?? "live"}`}
          role="status"
          aria-live="polite"
        >
          {shown && (
            <>
              <p className="dk-sub-text" title={shown.text}>
                {shown.text || "Working on it…"}
              </p>
              {(shown.badge || shown.kind === "running") && (
                <div className="dk-sub-meta">
                  {shown.badge && (
                    <span className={`dk-badge ${shown.badge.cls}`}>{shown.badge.text}</span>
                  )}
                  {shown.kind === "running" && (
                    <button type="button" className="dk-sub-stop" onClick={cancel}>
                      <Square size={10} fill="currentColor" />
                      Stop
                    </button>
                  )}
                </div>
              )}
              {shown.kind === "running" && <div className="dk-progress" aria-hidden="true" />}
            </>
          )}
        </div>
        <div
          className={`dk-ui dk-listen ${view.kind === "listening" ? "is-visible" : ""}`}
          title="Listening. No Wispr? Press Cmd+Shift+Space to type instead."
          aria-hidden="true"
        >
          <Mic size={14} />
          <span className="dk-listen-dot" />
        </div>
      </div>
    </>
  );
}
