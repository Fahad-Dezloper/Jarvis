// Deskhand engine entry. runCommand(text) builds a snapshot, asks /api/act for a
// plan (model path), falls back to the offline rules when that is unavailable,
// then executes the validated actions one at a time.
import { executeAction, targetRect } from "./executor.js";
import { planWithRules } from "./rules.js";
import { sanitizeActions } from "./schema.js";
import { buildSnapshot, installClipboardTap } from "./snapshot.js";

const STEP_DELAY_MS = 450;
const FETCH_TIMEOUT_MS = 30_000;

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

async function requestPlan(text, snapshot, history, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch("/api/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: text, snapshot, history }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Rate limited" : "The planner service returned an error");
    const plan = await res.json();
    if (!plan || !Array.isArray(plan.actions) || typeof plan.reply !== "string") {
      throw new Error("The planner returned an unexpected reply");
    }
    return {
      actions: sanitizeActions(plan.actions),
      reply: plan.reply,
      source: plan.source === "model" ? "model" : "rules",
      ...(plan.note ? { note: String(plan.note) } : {}),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** @type {import("../contract").RunCommand} */
export async function runCommand(text, opts = {}) {
  const { history = [], onEvent, signal } = opts;
  const emit = (e) => {
    try {
      onEvent?.(e);
    } catch {
      /* UI errors must not break a run */
    }
  };
  const command = String(text ?? "").trim();
  if (!command) {
    const reply = "I didn't hear anything.";
    emit({ type: "done", reply, ok: false });
    return { reply, source: "rules", ok: false };
  }

  let snapshot;
  try {
    installClipboardTap();
    snapshot = buildSnapshot();
  } catch {
    snapshot = null;
  }

  let plan;
  try {
    if (!snapshot) throw new Error("no snapshot");
    plan = await requestPlan(command, snapshot, history, signal);
  } catch (e) {
    if (signal?.aborted) {
      emit({ type: "done", reply: "Cancelled.", ok: false });
      return { reply: "Cancelled.", source: "rules", ok: false };
    }
    const note = /Rate limited/.test(e?.message)
      ? "Too many AI requests, so the offline rules planned this."
      : "The AI planner was unreachable, so the offline rules planned this.";
    plan = planWithRules(command, { history, snapshot: snapshot ?? undefined, note });
    plan.actions = sanitizeActions(plan.actions);
  }

  emit({ type: "plan", actions: plan.actions, reply: plan.reply, source: plan.source, ...(plan.note ? { note: plan.note } : {}) });

  for (let i = 0; i < plan.actions.length; i++) {
    if (signal?.aborted) {
      emit({ type: "done", reply: "Cancelled.", ok: false });
      return { reply: "Cancelled.", source: plan.source, ok: false };
    }
    const action = plan.actions[i];
    emit({ type: "step", index: i, action, status: "start", rect: targetRect(action) });
    const res = await executeAction(action);
    emit({ type: "step", index: i, action, status: res.ok ? "ok" : "fail", message: res.message, rect: targetRect(action) });
    if (!res.ok) {
      // A failed step usually breaks what follows (a missing window, say), so stop honestly.
      const reply = `${plan.reply} I stopped because: ${res.message}.`;
      emit({ type: "done", reply, ok: false });
      return { reply, source: plan.source, ok: false };
    }
    if (i < plan.actions.length - 1) await sleep(STEP_DELAY_MS, signal);
  }

  const ok = plan.actions.length > 0;
  emit({ type: "done", reply: plan.reply, ok });
  return { reply: plan.reply, source: plan.source, ok };
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__deskhand = { runCommand, buildSnapshot, planWithRules };
}
