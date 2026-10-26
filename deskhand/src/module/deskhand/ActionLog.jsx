import { Check, Circle, Loader2, Pin, X } from "lucide-react";
import useOrryStore from "./store";
import { humanize } from "./humanize";
import { logVisible } from "./subtitleLogic";

function StepIcon({ status }) {
  if (status === "ok") return <Check size={14} className="dk-step-ok" />;
  if (status === "fail") return <X size={14} className="dk-step-fail" />;
  if (status === "start") return <Loader2 size={14} className="dk-spin dk-step-run" />;
  return <Circle size={9} className="dk-step-wait" />;
}

export default function ActionLog() {
  const plan = useOrryStore((s) => s.plan);
  const steps = useOrryStore((s) => s.steps);
  const status = useOrryStore((s) => s.status);
  const pinned = useOrryStore((s) => s.logPinned);
  const setPinned = useOrryStore((s) => s.setLogPinned);

  const actions = plan?.actions ?? [];
  const visibleActions = actions.filter((a) => a.type !== "say");
  if (!visibleActions.length || !logVisible({ status, pinned, actionCount: actions.length })) {
    return null;
  }

  const finished = actions.filter((_, i) => steps[i]?.status === "ok").length;
  const total = actions.length;

  return (
    <section className="dk-ui dk-log" aria-label="Action log">
      <div className="dk-log-head">
        <span>Actions</span>
        <span className="dk-log-count">
          {finished}/{total}
        </span>
        <button
          type="button"
          className={`dk-icon-btn dk-log-pin ${pinned ? "is-pinned" : ""}`}
          onClick={() => setPinned(!pinned)}
          aria-pressed={pinned}
          aria-label={pinned ? "Unpin action log" : "Pin action log"}
          title={pinned ? "Unpin" : "Keep visible"}
        >
          {pinned ? <X size={13} /> : <Pin size={13} />}
        </button>
      </div>
      <ol className="dk-log-list">
        {actions.map((action, i) => {
          const st = steps[i];
          return (
            <li key={i} className={`dk-log-item ${st ? `is-${st.status}` : ""}`}>
              <span className="dk-log-icon">
                <StepIcon status={st?.status} />
              </span>
              <span className="dk-log-text">
                {humanize(action)}
                {st?.status === "fail" && st.message && (
                  <span className="dk-log-msg">{st.message}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
