import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Lightbulb, PartyPopper, X } from "lucide-react";
import useWindowsStore from "@store/window";
import useOrryStore from "./store";
import { BONUS, MISSIONS, countDone, isComplete, snapshotStore } from "./missionsLogic";

const DISMISS_KEY = "dk:missions-dismissed";

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
function writeDismissed(v) {
  try {
    window.localStorage.setItem(DISMISS_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

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
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);

  useEffect(() => {
    setOpen(!readDismissed());
  }, []);

  // Observe the window store; engine events tick missions inside the deskhand store.
  useEffect(() => {
    tick({ store: snapshotStore(useWindowsStore.getState()) });
    return useWindowsStore.subscribe((state) => tick({ store: snapshotStore(state) }));
  }, [tick]);

  const done = countDone(progress);
  const total = MISSIONS.length;
  const complete = isComplete(progress);
  const bonusDone = countDone(progress, BONUS);

  const close = () => {
    setOpen(false);
    writeDismissed(true);
  };
  const reopen = () => {
    setOpen(true);
    setMinimized(false);
    writeDismissed(false);
  };

  if (!open) {
    return (
      <button type="button" className="dk-ui dk-missions-pill" onClick={reopen}>
        <Lightbulb size={14} />
        <span>
          {done} of {total}
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
            onClick={() => setMinimized((m) => !m)}
            aria-label={minimized ? "Expand missions" : "Collapse missions"}
          >
            {minimized ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          <button
            type="button"
            className="dk-icon-btn"
            onClick={close}
            aria-label="Dismiss missions"
          >
            <X size={15} />
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

      {!minimized && (
        <>
          {complete && (
            <div className="dk-finish">
              <p className="dk-finish-title">All five done.</p>
              <p>What you just did: said it loosely, your desktop did it.</p>
              <a className="dk-finish-link" href="/docs">
                See how it works
              </a>
            </div>
          )}
          <ol className="dk-mission-list">
            {MISSIONS.map((m) => (
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
        </>
      )}
    </aside>
  );
}
