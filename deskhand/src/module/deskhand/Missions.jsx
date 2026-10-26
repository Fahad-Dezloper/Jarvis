import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Lightbulb, PartyPopper } from "lucide-react";
import useWindowsStore from "@store/window";
import useOrryStore from "./store";
import {
  BONUS,
  CHALLENGES,
  CORE_MISSIONS,
  MISSIONS,
  countDone,
  isComplete,
  snapshotStore,
} from "./missionsLogic";

/** The panel folds itself away this long after the finish state. */
export const AUTO_COLLAPSE_MS = 6000;

function Item({ item, done, index }) {
  const [hint, setHint] = useState(false);
  return (
    <li className={`dk-mission ${done ? "is-done" : ""}`}>
      <span className="dk-mission-mark" aria-hidden="true">
        {done ? <Check size={12} strokeWidth={3} /> : index}
      </span>
      <div className="dk-mission-body">
        <span className="dk-mission-label">{item.label}</span>
        {!done && (
          <button type="button" className="dk-link" onClick={() => setHint((h) => !h)}>
            {hint ? "Hide hint" : "Show hint"}
          </button>
        )}
        {hint && !done && <p className="dk-mission-hint">Say: &ldquo;{item.hint}&rdquo;</p>}
      </div>
    </li>
  );
}

export default function Missions() {
  const progress = useOrryStore((s) => s.missions);
  const tick = useOrryStore((s) => s.tickMissions);
  const [expanded, setExpanded] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);

  // Observe the window store; engine events tick missions inside the deskhand store.
  useEffect(() => {
    tick({ store: snapshotStore(useWindowsStore.getState()) });
    return useWindowsStore.subscribe((state) => tick({ store: snapshotStore(state) }));
  }, [tick]);

  const done = countDone(progress);
  const total = MISSIONS.length;
  const complete = isComplete(progress);
  const bonusDone = countDone(progress, BONUS);

  // Collapse to the pill a few seconds after the finish state.
  useEffect(() => {
    if (!complete) return undefined;
    const t = setTimeout(() => setExpanded(false), AUTO_COLLAPSE_MS);
    return () => clearTimeout(t);
  }, [complete]);

  if (!expanded) {
    return (
      <button
        type="button"
        className={`dk-ui dk-missions-pill ${complete ? "is-complete" : ""}`}
        onClick={() => setExpanded(true)}
        aria-label={`Try it: ${done} of ${total} missions done. Open the list.`}
      >
        {complete ? <PartyPopper size={14} /> : <Lightbulb size={14} />}
        <span>
          Try it:{" "}
          <b>
            {done}/{total}
          </b>
        </span>
      </button>
    );
  }

  return (
    <aside className={`dk-ui dk-missions ${complete ? "is-complete" : ""}`} aria-label="Missions">
      <header className="dk-missions-head">
        <div className="dk-missions-title">
          {complete ? <PartyPopper size={16} /> : <Lightbulb size={16} />}
          <h2>Try it with your voice</h2>
        </div>
        <div className="dk-missions-actions">
          <button
            type="button"
            className="dk-icon-btn"
            onClick={() => setExpanded(false)}
            aria-label="Collapse missions"
          >
            <ChevronUp size={15} />
          </button>
        </div>
      </header>

      <div className="dk-missions-progress">
        <div className="dk-missions-track">
          <div className="dk-missions-fill" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span>
          {done} of {total}
        </span>
      </div>

      {complete && (
        <div className="dk-finish">
          <p className="dk-finish-title">The five are done.</p>
          <p>You said it loosely, your desktop did it. Two challenges below if you want more.</p>
          <a className="dk-finish-link" href="/docs">
            See how it works
          </a>
        </div>
      )}
      <ol className="dk-mission-list">
        {CORE_MISSIONS.map((m) => (
          <Item key={m.id} item={m} done={!!progress.done[m.id]} index={m.id} />
        ))}
      </ol>
      <p className="dk-mission-divider">Challenge</p>
      <ol className="dk-mission-list" start={CORE_MISSIONS.length + 1}>
        {CHALLENGES.map((m) => (
          <Item key={m.id} item={m} done={!!progress.done[m.id]} index={m.id} />
        ))}
      </ol>

      <button type="button" className="dk-bonus-toggle" onClick={() => setBonusOpen((b) => !b)}>
        <span>Bonus</span>
        <span className="dk-log-count">
          {bonusDone}/{BONUS.length}
        </span>
        {bonusOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {bonusOpen && (
        <ul className="dk-mission-list dk-bonus-list">
          {BONUS.map((b, i) => (
            <Item key={b.id} item={b} done={!!progress.done[b.id]} index={i + 1} />
          ))}
        </ul>
      )}
    </aside>
  );
}
