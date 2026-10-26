import { useCallback, useEffect, useRef } from "react";
import useJarvisStore from "./store";
import { QUIET_MS, decideCommit, isRealEditable, shouldCaptureFocus } from "./voiceLogic";

// An invisible but real, focusable textarea. Dictation tools (Wispr Flow) type or
// paste into whichever editable element has focus, so this field is kept focused
// whenever the user is not typing in a real input. When its value has been quiet for
// QUIET_MS it is committed as one command and cleared. Enter commits immediately.
export default function VoiceCapture() {
  const ref = useRef(null);
  const changedAt = useRef(null);
  const timer = useRef(null);
  const evaluateRef = useRef(() => {});
  const paused = useRef(false); // Escape pauses capture until the next click or Cmd/Ctrl+K

  const busy = useJarvisStore((s) => s.status === "running");
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const focusCapture = useCallback((force = false) => {
    const el = ref.current;
    if (!el || typeof document === "undefined") return;
    if (!shouldCaptureFocus(document.activeElement, el, { paused: paused.current, force })) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
  }, []);

  const evaluate = useCallback((enter = false) => {
    const el = ref.current;
    if (!el) return;
    clearTimeout(timer.current);
    const d = decideCommit({
      value: el.value,
      changedAt: changedAt.current,
      now: Date.now(),
      busy: busyRef.current,
      enter,
    });
    const store = useJarvisStore.getState();
    if (d.action === "wait") {
      timer.current = setTimeout(() => evaluateRef.current(false), d.waitMs + 20);
    } else if (d.action === "commit") {
      el.value = "";
      changedAt.current = null;
      store.setLive("");
      store.submit(d.text);
    } else if (d.action === "discard") {
      el.value = "";
      changedAt.current = null;
      store.setLive("");
    }
    // "hold": stay as is; the busy effect below re-evaluates when the engine frees up.
  }, []);

  useEffect(() => {
    evaluateRef.current = evaluate;
  }, [evaluate]);

  // Text can arrive as a burst of input events; coalesce the live-transcript update to one per frame.
  const pendingLive = useRef("");
  const liveFrame = useRef(0);
  const onInput = useCallback(
    (e) => {
      changedAt.current = Date.now();
      pendingLive.current = e.target.value.replace(/\s+/g, " ").trim();
      if (!liveFrame.current) {
        liveFrame.current = requestAnimationFrame(() => {
          liveFrame.current = 0;
          useJarvisStore.getState().setLive(pendingLive.current);
        });
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => evaluate(false), QUIET_MS + 20);
    },
    [evaluate],
  );

  // Engine just became free: send whatever was held, and take focus back.
  const prevBusy = useRef(false);
  useEffect(() => {
    if (prevBusy.current && !busy) {
      const t = setTimeout(() => {
        focusCapture();
        if (ref.current?.value) evaluate(false);
      }, 60);
      prevBusy.current = busy;
      return () => clearTimeout(t);
    }
    prevBusy.current = busy;
    return undefined;
  }, [busy, evaluate, focusCapture]);

  // Focus on mount (boot animation and windows can steal it, so retry), plus a watchdog.
  useEffect(() => {
    const timers = [60, 400, 1200].map((ms) => setTimeout(() => focusCapture(), ms));
    const watchdog = setInterval(() => {
      const a = document.activeElement;
      if (!a || a === document.body) focusCapture();
    }, 1500);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(watchdog);
      clearTimeout(timer.current);
    };
  }, [focusCapture]);

  // Refocus on window focus, tab visible, any click, and when a real input loses focus.
  useEffect(() => {
    const onWinFocus = () => focusCapture();
    const onVisible = () => {
      if (document.visibilityState === "visible") focusCapture();
    };
    const afterClick = () => {
      paused.current = false;
      setTimeout(() => focusCapture(), 0);
    };
    const onFocusOut = (e) => {
      if (e.target === ref.current) return;
      if (!isRealEditable(e.target, ref.current)) return;
      setTimeout(() => focusCapture(), 0);
    };
    window.addEventListener("focus", onWinFocus);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("click", afterClick, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      window.removeEventListener("focus", onWinFocus);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("click", afterClick, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [focusCapture]);

  // Cmd/Ctrl+K forces capture from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        paused.current = false;
        focusCapture(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focusCapture]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      evaluate(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      const store = useJarvisStore.getState();
      if (ref.current?.value) {
        ref.current.value = "";
        changedAt.current = null;
        store.setLive("");
      } else if (store.status === "running") {
        store.cancel();
      } else {
        paused.current = true;
        ref.current?.blur();
      }
    }
  };

  return (
    <textarea
      ref={ref}
      className="dk-voice-capture"
      aria-label="Voice input"
      tabIndex={0}
      inputMode="none"
      rows={1}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onFocus={() => useJarvisStore.getState().setCaptureFocused(true)}
      onBlur={() => useJarvisStore.getState().setCaptureFocused(false)}
    />
  );
}
