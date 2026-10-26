import { useEffect, useRef } from "react";
import useJarvisStore from "./store";

// Fallback for people without Wispr Flow: Cmd/Ctrl+Shift+Space opens a small field.
export default function TypeInstead() {
  const open = useJarvisStore((s) => s.typeOpen);
  const setOpen = useJarvisStore((s) => s.setTypeOpen);
  const submit = useJarvisStore((s) => s.submit);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        setOpen(!useJarvisStore.getState().typeOpen);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setOpen]);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const text = e.currentTarget.value.trim();
      if (text.length < 2) return;
      close();
      submit(text);
    }
  };

  return (
    <div className="dk-ui dk-type" role="dialog" aria-label="Type instead">
      <label htmlFor="dk-type-input">Type instead</label>
      <input
        ref={inputRef}
        id="dk-type-input"
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="Type a command and press Enter"
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
