import { useCallback, useEffect, useRef, useState } from "react";
import useJarvisStore from "./store";
import { QUIET_MS, decideCommit, isRealEditable, shouldCaptureFocus } from "./voiceLogic";

// How long a click or keystroke in a real field keeps dictation from being pulled back to the voice field.
const INTENT_MS = 5000;

// An invisible but real, focusable textarea. Dictation tools (Wispr Flow) type or
// paste into whichever editable element has focus, so this field is kept focused
// whenever the user is not typing in a real input. When its value has been quiet for
// QUIET_MS it is committed as one command and cleared. Enter commits immediately.
export default function VoiceCapture() {
  const ref = useRef(null);
  const changedAt = useRef(null);
  const seenValue = useRef(""); // last value noticed in the field (also lets the poll catch silent changes)
  const timer = useRef(null);
  const evaluateRef = useRef(() => {});
  const paused = useRef(false); // kept for the pure helper; Escape no longer pauses capture
  // The user "owns" a real field (Notes, search box, terminal) only for a few seconds after clicking or
  // typing in it. After that dictation goes back to the voice field, and apps that grab focus on their
  // own (a terminal that auto-focuses, a search box that opens focused) never hold it.
  const intentUntil = useRef(0);
  const lastInput = useRef({ at: 0, chars: 0 });
  const lastPaste = useRef({ at: 0, chars: 0, kinds: "" });
  const commits = useRef(0);
  const [debug, setDebug] = useState(null); // null = off; object = live readout (add ?debug to the URL)
  const hasIntent = () => Date.now() < intentUntil.current;
  const markIntent = () => {
    intentUntil.current = Date.now() + INTENT_MS;
  };
  const clearIntent = () => {
    intentUntil.current = 0;
  };

  const busy = useJarvisStore((s) => s.status === "running");
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const focusCapture = useCallback((force = false) => {
    const el = ref.current;
    if (!el || typeof document === "undefined") return;
    // Without a deliberate click into a field, reclaim focus even from another editable element.
    const reclaim = force || !hasIntent();
    if (!shouldCaptureFocus(document.activeElement, el, { paused: paused.current, force: reclaim })) return;
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
      seenValue.current = "";
      changedAt.current = null;
      store.setLive("");
      commits.current += 1;
      console.info(`[jarvis] voice commit #${commits.current}: "${d.text.slice(0, 80)}"`);
      store.submit(d.text);
    } else if (d.action === "discard") {
      el.value = "";
      seenValue.current = "";
      changedAt.current = null;
      store.setLive("");
    }
    // "hold": stay as is; the busy effect below re-evaluates when the engine frees up.
  }, []);

  useEffect(() => {
    evaluateRef.current = evaluate;
  }, [evaluate]);

  // Text can arrive as a burst of events, or with no input event at all (some dictation tools set the
  // field's value directly). So changes are noticed three ways: every related DOM event, and a poll of the
  // value. Live-transcript updates are coalesced to one per frame.
  const pendingLive = useRef("");
  const liveFrame = useRef(0);
  const eventCounts = useRef({});
  const lastSource = useRef("-");
  const noteValue = useCallback(
    (source) => {
      const el = ref.current;
      if (!el) return;
      const v = el.value;
      if (v === seenValue.current && source === "poll") return;
      seenValue.current = v;
      lastSource.current = source;
      changedAt.current = Date.now();
      lastInput.current = { at: Date.now(), chars: v.length };
      pendingLive.current = v.replace(/\s+/g, " ").trim();
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const types = ["input", "beforeinput", "paste", "change", "keyup", "compositionend", "textInput", "drop"];
    const handlers = types.map((type) => {
      const fn = () => {
        eventCounts.current[type] = (eventCounts.current[type] || 0) + 1;
        setTimeout(() => noteValue(type), 0);
      };
      el.addEventListener(type, fn);
      return [type, fn];
    });
    // Dictation tools paste via the clipboard and restore it right after. Read the text straight from the
    // paste event (rather than trusting the browser to insert it), and say so when a paste arrives empty.
    const onPaste = (e) => {
      let text = "";
      let kinds = "";
      try {
        text = e.clipboardData?.getData("text/plain") ?? "";
        kinds = Array.from(e.clipboardData?.types ?? []).join(",");
      } catch {
        /* clipboard unreadable */
      }
      lastPaste.current = { at: Date.now(), chars: text.length, kinds };
      if (text.trim()) {
        e.preventDefault();
        const cur = el.value.trim();
        el.value = cur ? `${cur} ${text}` : text;
        noteValue("paste");
      } else {
        console.warn(`[jarvis] empty paste (types: ${kinds || "none"}). The dictation tool pasted nothing.`);
        useJarvisStore.setState((st) => ({
          error: "That dictation arrived empty. Please say it again.",
          ok: false,
          cancelled: false,
          resultSeq: st.resultSeq + 1,
        }));
      }
    };
    el.addEventListener("paste", onPaste, true);
    const poll = setInterval(() => {
      if (el.value !== seenValue.current) {
        eventCounts.current.poll = (eventCounts.current.poll || 0) + 1;
        noteValue("poll");
      }
    }, 100);
    return () => {
      handlers.forEach(([type, fn]) => el.removeEventListener(type, fn));
      el.removeEventListener("paste", onPaste, true);
      clearInterval(poll);
    };
  }, [noteValue]);

  // Engine just became free: send whatever was held, and take focus back.
  const prevBusy = useRef(false);
  useEffect(() => {
    if (prevBusy.current && !busy) {
      clearIntent();
      const t = setTimeout(() => {
        focusCapture(true);
        if (ref.current?.value) evaluate(false);
      }, 60);
      prevBusy.current = busy;
      return () => clearTimeout(t);
    }
    if (!prevBusy.current && busy) clearIntent();
    prevBusy.current = busy;
    return undefined;
  }, [busy, evaluate, focusCapture]);

  // Focus on mount (boot animation and windows can steal it, so retry), plus a watchdog.
  useEffect(() => {
    const timers = [60, 400, 1200].map((ms) => setTimeout(() => focusCapture(), ms));
    const watchdog = setInterval(() => {
      const a = document.activeElement;
      if (a !== ref.current && (!a || a === document.body || !hasIntent())) focusCapture();
    }, 400);
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
    const onPointerDown = (e) => {
      // A click straight into a real field means "I want to type here"; any other click does not.
      if (e.target && e.target !== ref.current && isRealEditable(e.target, ref.current)) markIntent();
      else clearIntent();
    };
    const afterClick = () => {
      paused.current = false;
      setTimeout(() => focusCapture(), 0);
    };
    const onFocusIn = (e) => {
      if (e.target === ref.current) return;
      if (hasIntent() || !isRealEditable(e.target, ref.current)) return;
      // An app focused one of its own fields by itself: take dictation focus back, now and after it settles.
      [0, 120, 400].forEach((ms) => setTimeout(() => focusCapture(), ms));
    };
    const onFocusOut = (e) => {
      if (e.target === ref.current) return;
      if (!isRealEditable(e.target, ref.current)) return;
      setTimeout(() => focusCapture(), 0);
    };
    window.addEventListener("focus", onWinFocus);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", afterClick, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      window.removeEventListener("focus", onWinFocus);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", afterClick, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [focusCapture]);

  // Typing into a real field counts as "owning" it for a few more seconds.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Fn" || e.key === "Escape") return;
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Enter") return;
      const a = document.activeElement;
      if (a && a !== ref.current && isRealEditable(a, ref.current)) markIntent();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show "listening" only while Fn is held, where the browser reports it at all (most Mac browsers do not).
  useEffect(() => {
    const isFn = (e) => e.key === "Fn" || e.code === "Fn" || (typeof e.getModifierState === "function" && e.getModifierState("Fn"));
    const down = (e) => {
      if (isFn(e)) useJarvisStore.getState().setFnHeld(true);
    };
    const up = (e) => {
      if (e.key === "Fn" || e.code === "Fn" || !isFn(e)) useJarvisStore.getState().setFnHeld(false);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, []);

  // Cmd/Ctrl+K forces capture from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        paused.current = false;
        clearIntent();
        focusCapture(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focusCapture]);

  useEffect(() => {
    if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("debug")) return undefined;
    const t = setInterval(() => {
      const a = document.activeElement;
      const where = a === ref.current ? "voice field" : a ? `${a.tagName.toLowerCase()}${a.className ? "." + String(a.className).split(" ")[0] : ""}` : "none";
      const ago = lastInput.current.at ? `${((Date.now() - lastInput.current.at) / 1000).toFixed(1)}s ago (${lastInput.current.chars} chars)` : "never";
      setDebug({
        where,
        ago,
        commits: commits.current,
        intent: hasIntent(),
        busy: busyRef.current,
        via: lastSource.current,
        events: Object.entries(eventCounts.current).map(([k, v]) => `${k}:${v}`).join(" ") || "none yet",
        value: (ref.current?.value || "").length,
        paste: lastPaste.current.at
          ? `${((Date.now() - lastPaste.current.at) / 1000).toFixed(1)}s ago, ${lastPaste.current.chars} chars [${lastPaste.current.kinds || "no types"}]`
          : "none yet",
      });
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      evaluate(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      const store = useJarvisStore.getState();
      if (ref.current?.value) {
        ref.current.value = "";
        seenValue.current = "";
        changedAt.current = null;
        store.setLive("");
      } else if (store.status === "running") {
        store.cancel();
      }
      // Never pause or blur: Wispr uses Esc to cancel a dictation, and that must not turn capture off.
    }
  };

  return (
    <>
      {debug && (
        <div
          style={{ position: "fixed", top: 44, right: 12, zIndex: 99999, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,.72)", color: "#fff", font: "11px/1.5 ui-monospace, monospace", pointerEvents: "none" }}
        >
          <div>focus: <b style={{ color: debug.where === "voice field" ? "#6ee7b7" : "#fca5a5" }}>{debug.where}</b></div>
          <div>last text: {debug.ago}</div>
          <div>commands sent: {debug.commits}</div>
          <div>engine busy: {String(debug.busy)} · typing in a field: {String(debug.intent)}</div>
          <div>arrived via: {debug.via} · field now holds {debug.value} chars</div>
          <div>events seen: {debug.events}</div>
          <div>last paste: {debug.paste}</div>
        </div>
      )}
    <textarea
      ref={ref}
      className="dk-voice-capture"
      aria-label="Voice input"
      tabIndex={0}
      rows={1}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onKeyDown={onKeyDown}
      onFocus={() => useJarvisStore.getState().setCaptureFocused(true)}
      onBlur={() => useJarvisStore.getState().setCaptureFocused(false)}
    />
    </>
  );
}
