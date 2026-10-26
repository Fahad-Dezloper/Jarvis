import { useEffect, useState } from "react";
import { X } from "lucide-react";
import useJarvisStore from "./store";

const KEY = "dk:hint-seen";

function seenBefore() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export default function FirstVisitHint() {
  const dismissed = useJarvisStore((s) => s.hintDismissed);
  const dismiss = useJarvisStore((s) => s.dismissHint);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (seenBefore()) return undefined;
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (dismissed) markSeen();
  }, [dismissed]);

  // Shown once: mark as seen as soon as it appears, and fade it after a while.
  useEffect(() => {
    if (!ready) return undefined;
    markSeen();
    const t = setTimeout(dismiss, 14000);
    return () => clearTimeout(t);
  }, [ready, dismiss]);

  if (!ready || dismissed) return null;

  return (
    <div className="dk-ui dk-hint" role="status">
      <p>
        Hold <kbd>Fn</kbd>, speak, release. Jarvis listens, subtitles show what it heard.
        <span className="dk-hint-sub">No Wispr Flow? Press Cmd+Shift+Space to type instead.</span>
      </p>
      <button type="button" className="dk-icon-btn" onClick={dismiss} aria-label="Dismiss hint">
        <X size={14} />
      </button>
    </div>
  );
}
