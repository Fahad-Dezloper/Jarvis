import { Check, ChevronDown, ChevronUp, Circle, Loader2, X } from "lucide-react";
import useOrryStore from "./store";
import { humanize } from "./humanize";

function StepIcon({ status }) {
  if (status === "ok") return <Check size={14} className="dk-step-ok" />;
  if (status === "fail") return <X size={14} className="dk-step-fail" />;
  if (status === "start") return <Loader2 size={14} className="dk-spin dk-step-run" />;
  return <Circle size={9} className="dk-step-wait" />;
}

export default function ActionLog() {
  const plan = useOrryStore((s) => s.plan);
  const steps = useOrryStore((s) => s.steps);
  const logOpen = useOrryStore((s) => s.logOpen);
  const setLogOpen = useOrryStore((s) => s.setLogOpen);
  const collapsed = useOrryStore((s) => s.collapsed);

  const actions = plan?.actions ?? [];
  const visible = actions.filter((a) => a.type !== "say");
  if (!visible.length || collapsed) return null;

  const finished = actions.filter((_, i) => steps[i]?.status === "ok").length;
  const total = actions.length;

  return (
    <section className="dk-ui dk-log" aria-label="Action log">
      <button
        type="button"
        className="dk-log-head"
        onClick={() => setLogOpen(!logOpen)}
        aria-expanded={logOpen}
      >
        <span>Actions</span>
        <span className="dk-log-count">
          {finished}/{total}
        </span>
        {logOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {logOpen && (
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
      )}
    </section>
  );
}
