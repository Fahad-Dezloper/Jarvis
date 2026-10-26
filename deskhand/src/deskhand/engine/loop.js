// The multi-step agent loop, free of DOM, store and alias imports so it runs
// under plain tsx in scripts/check-engine.mjs. index.js wires the real
// snapshot, planner and executor into it; tests wire scripted fakes.
//
// Each round: snapshot -> plan the next batch (1-4 actions) -> execute ->
// collect each handler's {message, data} as OBSERVATIONS -> if the planner said
// done:false, go again with the observations appended. Stops when a plan says
// done:true, when the round or time budget is spent, or when aborted.
//
// Events (all backwards compatible with EngineEvent in ../contract.js):
//   {type:"plan", actions, reply, source, note?, round, done}
//   {type:"step", index, action, status:"start"|"ok"|"fail", message?, rect?, round}
//   {type:"observation", index, text}            text is truncated for the UI
//   {type:"done", reply, ok}                     reply is the FINAL answer

export const MAX_ROUNDS = 8;
export const VERIFY_MIN_ACTIONS = 4;
export const BUDGET_MS = 90_000;
export const UI_OBS_CHARS = 600;
export const PLANNER_OBS_CHARS = 4000;
const MIN_ROUND_MS = 2500;
const MAX_FAILED_ROUNDS = 2;

/** Collapse to a clipped string with an ellipsis. */
export function truncate(text, max) {
  const t = String(text ?? "").replace(/[ \t]+\n/g, "\n").trim();
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…` : t;
}

/** Short human/planner-readable label for an action. */
export function describeAction(a) {
  if (!a) return "";
  switch (a.type) {
    case "invoke": {
      let args;
      try {
        args = JSON.stringify(a.args ?? {});
      } catch {
        args = "{}";
      }
      return `${a.app}.${a.name}(${truncate(args, 120)})`;
    }
    case "open":
    case "close":
    case "minimize":
    case "maximize":
    case "restore":
    case "focus":
      return `${a.type} ${a.window}`;
    case "type":
      return `type into ${a.window}`;
    case "click":
      return `click "${a.target}" in ${a.window}`;
    default:
      return a.type;
  }
}

/** A plain-text digest of the observations, used when no planner is available. */
export function summarizeObservations(observations) {
  const withText = (observations ?? []).filter((o) => o.ok && (o.data || o.message));
  if (!withText.length) return "";
  const last = withText[withText.length - 1];
  return truncate(last.data ? `${last.message}\n${last.data}` : last.message, 400);
}

/**
 * @typedef {Object} LoopDeps
 * @property {() => object|null} snapshot
 * @property {(req:{command:string,snapshot:object|null,history:object[],observations:object[],round:number,deadline:number}) => Promise<{actions:object[],reply:string,done?:boolean,source?:string,note?:string,followup?:object}>} plan
 * @property {(action:object) => Promise<{ok:boolean,message:string,data?:string}>} execute
 * @property {(action:object) => (object|undefined)} [rect]
 * @property {(followup:object, observations:object[]) => ({reply:string,done:boolean})} [resolveFollowup]
 * @property {(ms:number, signal?:AbortSignal) => Promise<void>} [sleep]
 * @property {() => number} [now]
 * @property {number} [stepDelayMs]
 * @property {number} [budgetMs]
 * @property {number} [maxRounds]
 */

/**
 * @param {string} text
 * @param {{history?:object[], onEvent?:(e:object)=>void, signal?:AbortSignal}} opts
 * @param {LoopDeps} deps
 */
export async function runLoop(text, opts, deps) {
  const { history = [], onEvent, signal } = opts ?? {};
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const stepDelay = deps.stepDelayMs ?? 450;
  const maxRounds = deps.maxRounds ?? MAX_ROUNDS;
  const budget = deps.budgetMs ?? BUDGET_MS;
  const start = now();
  const deadline = start + budget;

  const emit = (e) => {
    try {
      onEvent?.(e);
    } catch {
      /* UI errors must not break a run */
    }
  };

  const command = String(text ?? "").trim();
  let source = "rules";
  let stepIndex = 0;
  let executed = 0;
  const observations = [];

  const finish = (reply, ok) => {
    emit({ type: "done", reply, ok });
    return { reply, source, ok };
  };
  const cancelled = () => finish("Cancelled.", false);
  const leftover = () => {
    const s = summarizeObservations(observations);
    return s ? ` What I have so far: ${s}` : "";
  };

  if (!command) return finish("I didn't hear anything.", false);

  let round = 0;
  let pendingFollowup = null;
  let lastSig = "";
  let failedRounds = 0;
  // Completeness check: a model can stop early on a long, multi-part request and still say "done".
  // After a big model plan has run, give it one chance to compare the original request with what was executed.
  const executedLog = [];
  let verified = false;
  let verifyObs = null;

  for (;;) {
    if (signal?.aborted) return cancelled();
    if (round >= maxRounds) return finish(`I ran out of steps before finishing.${leftover()}`, false);
    if (round > 0 && deadline - now() < MIN_ROUND_MS) return finish(`I ran out of time before finishing.${leftover()}`, false);
    round++;

    let planRes;
    if (pendingFollowup) {
      const f = pendingFollowup;
      pendingFollowup = null;
      const r = deps.resolveFollowup ? deps.resolveFollowup(f, observations) : { reply: summarizeObservations(observations), done: true };
      planRes = { actions: [], reply: r.reply, done: r.done !== false, source: "rules" };
    } else {
      let snapshot = null;
      try {
        snapshot = deps.snapshot();
      } catch {
        /* planning continues without a snapshot */
      }
      try {
        planRes = await deps.plan({ command, snapshot, history, observations: observations.map(toPlannerObservation).concat(verifyObs ? [verifyObs] : []), round, deadline });
      } catch (e) {
        if (signal?.aborted) return cancelled();
        const why = e?.message ? ` (${truncate(e.message, 120)})` : "";
        return finish(`I couldn't plan the next step${why}.${leftover()}`, false);
      }
    }
    if (signal?.aborted) return cancelled();

    const actions = Array.isArray(planRes.actions) ? planRes.actions : [];
    if (planRes.source === "model") source = "model";
    const planSource = planRes.source === "model" ? "model" : "rules";
    const hasFollowup = !!planRes.followup && planRes.done === false;
    const done = hasFollowup ? false : planRes.done !== false || actions.length === 0;
    const reply = String(planRes.reply ?? "").trim();

    emit({ type: "plan", actions, reply, source: planSource, round, done, ...(planRes.note ? { note: planRes.note } : {}) });

    if (!done && !hasFollowup) {
      const sig = JSON.stringify(actions);
      if (sig === lastSig) return finish(`I got stuck repeating the same step, so I stopped.${leftover()}`, false);
      lastSig = sig;
    }

    let failure = null;
    for (let i = 0; i < actions.length; i++) {
      if (signal?.aborted) return cancelled();
      if (now() > deadline) return finish(`I ran out of time before finishing.${leftover()}`, false);
      const action = actions[i];
      const index = stepIndex++;
      emit({ type: "step", index, action, status: "start", round, rect: deps.rect?.(action) });
      const res = await deps.execute(action);
      executed++;
      executedLog.push(`${res.ok ? "" : "(failed) "}${describeAction(action)}`);
      emit({ type: "step", index, action, status: res.ok ? "ok" : "fail", message: res.message, round, rect: deps.rect?.(action) });
      const hasText = action.type === "invoke" || !res.ok;
      if (hasText) {
        const obs = { index, action: describeAction(action), ok: !!res.ok, message: String(res.message ?? ""), ...(res.data ? { data: String(res.data) } : {}) };
        observations.push(obs);
        emit({ type: "observation", index, text: truncate(res.ok ? (obs.data ? `${obs.message}\n${obs.data}` : obs.message) : `Failed: ${obs.message}`, UI_OBS_CHARS) });
      }
      if (!res.ok) {
        failure = res.message;
        break;
      }
      if (i < actions.length - 1) await sleep(stepDelay, signal);
    }

    if (failure !== null) {
      failedRounds++;
      // A model planner can see the failure and adapt; rules cannot.
      if (planSource === "model" && failedRounds <= MAX_FAILED_ROUNDS && round < maxRounds) {
        await sleep(stepDelay, signal);
        continue;
      }
      return finish(`${reply ? `${reply} ` : ""}I stopped because: ${failure}.`.trim(), false);
    }

    if (hasFollowup) {
      pendingFollowup = planRes.followup;
      await sleep(stepDelay, signal);
      continue;
    }

    if (done && planSource === "model" && !verified && executed >= VERIFY_MIN_ACTIONS && round < maxRounds && deadline - now() > MIN_ROUND_MS) {
      verified = true;
      verifyObs = {
        index: 9999,
        action: "verification",
        ok: true,
        text: truncate(
          `VERIFICATION ROUND. Everything below has already been executed, in order: ${executedLog.join("; ")}. Compare it with the ORIGINAL REQUEST, part by part. If any part of the request has not been done yet, return actions for ONLY the remaining parts. If every part is done, return no actions, done=true and a one-sentence reply.`,
          PLANNER_OBS_CHARS,
        ),
      };
      await sleep(Math.min(stepDelay, 300), signal);
      continue;
    }

    if (done) {
      const final = reply || summarizeObservations(observations) || (executed ? "Done." : "I couldn't find a way to do that.");
      return finish(final, executed > 0);
    }

    // not done: let the UI settle, then re-snapshot and plan again
    await sleep(Math.min(stepDelay, 300), signal);
  }
}

function toPlannerObservation(o) {
  const text = o.ok ? (o.data ? `${o.message}\n${o.data}` : o.message) : `FAILED: ${o.message}`;
  return { index: o.index, action: o.action, ok: o.ok, text: truncate(text, PLANNER_OBS_CHARS) };
}

const MAX_OBSERVATIONS = 12;
const OBS_TOTAL_CHARS = 14_000;

/** Observations come from the client and may carry page text: cap sizes and shapes, keep them as plain data. */
export function cleanObservations(list) {
  let budget = OBS_TOTAL_CHARS;
  const out = [];
  for (const o of (Array.isArray(list) ? list : []).slice(-MAX_OBSERVATIONS)) {
    if (!o || typeof o !== "object") continue;
    const room = Math.min(4000, Math.max(0, budget));
    const text = room > 0 ? truncate(typeof o.text === "string" ? o.text : "", room) : "";
    budget -= text.length;
    out.push({
      index: Number.isFinite(o.index) ? Math.max(0, Math.min(999, Math.round(o.index))) : out.length,
      action: truncate(typeof o.action === "string" ? o.action : "", 160),
      ok: o.ok !== false,
      text,
    });
  }
  return out;
}

