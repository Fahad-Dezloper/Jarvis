import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, Square } from "lucide-react";
import useWindowsStore from "@store/window";
import useDeskhandStore from "./store";

const IGNORE_REFOCUS =
  "input, textarea, select, button, a, [contenteditable='true'], nav, #dock, .dock-container, .macos-notch-container, .dk-ui";

function sourceBadge(source) {
  if (source === "model") return { text: "AI", cls: "dk-badge-ai" };
  if (source === "rules") return { text: "Offline rules", cls: "dk-badge-rules" };
  return null;
}

export default function CommandBar() {
  const inputRef = useRef(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const recallRef = useRef(-1);

  const status = useDeskhandStore((s) => s.status);
  const reply = useDeskhandStore((s) => s.reply);
  const source = useDeskhandStore((s) => s.source);
  const ok = useDeskhandStore((s) => s.ok);
  const error = useDeskhandStore((s) => s.error);
  const cancelled = useDeskhandStore((s) => s.cancelled);
  const collapsed = useDeskhandStore((s) => s.collapsed);
  const history = useDeskhandStore((s) => s.history);
  const submit = useDeskhandStore((s) => s.submit);
  const cancel = useDeskhandStore((s) => s.cancel);
  const setCollapsed = useDeskhandStore((s) => s.setCollapsed);

  const running = status === "running";

  const focusBar = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    setCollapsed(false);
  }, [setCollapsed]);

  // Auto-grow the textarea to fit long dictated text.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  // Focus once the desktop appears (windows and the boot animation can steal it, so retry).
  useEffect(() => {
    const timers = [80, 500, 1400].map((ms) =>
      setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) focusBar();
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [focusBar]);

  // Cmd/Ctrl+K focuses the bar from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusBar();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focusBar]);

  // Clicking the desktop background hands focus back to the bar.
  useEffect(() => {
    const onClick = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(IGNORE_REFOCUS)) return;
      const windowIds = Object.keys(useWindowsStore.getState().windows)
        .map((k) => `#${k}`)
        .join(",");
      if (windowIds && t.closest(windowIds)) return;
      focusBar();
    };
    const onUp = (e) => setTimeout(() => onClick(e), 0);
    document.addEventListener("click", onClick);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mouseup", onUp);
    };
  }, [focusBar]);

  // Refocus after each command finishes.
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !running) {
      const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
      prevRunning.current = running;
      return () => clearTimeout(t);
    }
    prevRunning.current = running;
  }, [running]);

  const send = useCallback(async () => {
    const text = value.trim();
    if (!text || running) return;
    setValue("");
    recallRef.current = -1;
    await submit(text);
  }, [value, running, submit]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCollapsed(true);
      inputRef.current?.blur();
    } else if (e.key === "ArrowUp" && !value && history.length) {
      e.preventDefault();
      recallRef.current = Math.min(recallRef.current + 1, history.length - 1);
      setValue(history[history.length - 1 - recallRef.current].command);
    }
  };

  const badge = sourceBadge(source);
  const hasFeedback = running || error || cancelled || reply;
  const showFeedback = hasFeedback && !collapsed;
  const tone = error || (!ok && !running) ? "dk-tone-bad" : "";

  return (
    <div
      className={`dk-ui dk-bar ${focused ? "is-focused" : ""} ${running ? "is-running" : ""}`}
      role="search"
      aria-label="Deskhand command bar"
    >
      <div className="dk-bar-glow" aria-hidden="true" />
      <div className="dk-bar-row">
        <span className="dk-bar-icon" aria-hidden="true">
          {running ? <Loader2 size={20} className="dk-spin" /> : <Sparkles size={20} />}
        </span>
        <textarea
          ref={inputRef}
          id="dk-command-input"
          className="dk-bar-input"
          rows={1}
          value={value}
          placeholder="Hold Fn and speak, or type"
          aria-label="Command"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            if (collapsed) setCollapsed(false);
          }}
          onFocus={() => {
            setFocused(true);
            setCollapsed(false);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        {running ? (
          <button
            type="button"
            className="dk-bar-btn dk-bar-cancel"
            onClick={cancel}
            aria-label="Cancel"
          >
            <Square size={13} fill="currentColor" />
            <span>Cancel</span>
          </button>
        ) : (
          <>
            {!value && <kbd className="dk-kbd">{"⌘"}K</kbd>}
            {value.trim() && (
              <button
                type="button"
                className="dk-bar-btn dk-bar-send"
                onClick={send}
                aria-label="Send"
              >
                <ArrowUp size={17} />
              </button>
            )}
          </>
        )}
      </div>

      {running && <div className="dk-progress" aria-hidden="true" />}

      {showFeedback && (
        <div className={`dk-feedback ${tone}`} aria-live="polite">
          <p className="dk-reply">
            {error ? error : running && !reply ? "Working on it…" : cancelled ? "Stopped." : reply}
          </p>
          {badge && !error && !cancelled && (
            <span className={`dk-badge ${badge.cls}`}>{badge.text}</span>
          )}
        </div>
      )}
    </div>
  );
}
