import { useEffect, useState } from "react";
import { X } from "lucide-react";
import useDeskhandStore from "./store";

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
  const dismissed = useDeskhandStore((s) => s.hintDismissed);
  const dismiss = useDeskhandStore((s) => s.dismissHint);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (seenBefore()) return undefined;
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (dismissed) markSeen();
  }, [dismissed]);

  if (!ready || dismissed) return null;

  return (
    <div className="dk-ui dk-hint" role="status">
      <p>
        Hold <kbd>Fn</kbd>, speak. Try: &ldquo;open Claude Code and run npm run dev&rdquo;
      </p>
      <button type="button" className="dk-icon-btn" onClick={dismiss} aria-label="Dismiss hint">
        <X size={14} />
      </button>
    </div>
  );
}
