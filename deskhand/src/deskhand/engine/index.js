// Jarvis engine entry. runCommand(text) runs the multi-step agent loop (loop.js):
// snapshot -> plan the next batch via /api/act (model) or the offline rules ->
// execute -> feed each handler's result back as an observation -> repeat until
// the planner says it is done or the round/time budget is spent.
import { executeAction, targetRect } from "./executor.js";
import { resolveFollowup, sanitizeFollowup } from "./followups.js";
import { runLoop } from "./loop.js";
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

const newCommandId = () => (globalThis.crypto?.randomUUID?.() ?? `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`).slice(0, 64);

async function requestPlan(req, commandId, signal) {
  const ctrl = new AbortController();
  const remaining = Number.isFinite(req.deadline) ? req.deadline - Date.now() : FETCH_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), Math.max(8_000, Math.min(FETCH_TIMEOUT_MS, remaining + 5_000)));
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch("/api/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: req.command, snapshot: req.snapshot, history: req.history, observations: req.observations, round: req.round, commandId }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Rate limited" : "The planner service returned an error");
    const plan = await res.json();
    if (!plan || !Array.isArray(plan.actions) || typeof plan.reply !== "string") {
      throw new Error("The planner returned an unexpected reply");
    }
    const followup = sanitizeFollowup(plan.followup);
    return {
      actions: sanitizeActions(plan.actions),
      reply: plan.reply,
      done: followup ? false : plan.done !== false,
      ...(followup ? { followup } : {}),
      source: plan.source === "model" ? "model" : "rules",
      ...(plan.note ? { note: String(plan.note) } : {}),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Round 1 falls back to the offline rules when the service is unreachable; later rounds report the failure. */
function makePlanner(signal) {
  const commandId = newCommandId();
  return async (req) => {
    try {
      if (!req.snapshot) throw new Error("no snapshot");
      return await requestPlan(req, commandId, signal);
    } catch (e) {
      if (signal?.aborted || req.round > 1) throw e;
      const note = /Rate limited/.test(e?.message)
        ? "Too many AI requests, so the offline rules planned this."
        : "The AI planner was unreachable, so the offline rules planned this.";
      const plan = planWithRules(req.command, { history: req.history, snapshot: req.snapshot ?? undefined, note });
      const followup = sanitizeFollowup(plan.followup);
      return { ...plan, actions: sanitizeActions(plan.actions), ...(followup ? { followup, done: false } : { done: true }) };
    }
  };
}

/** @type {import("../contract").RunCommand} */
export async function runCommand(text, opts = {}) {
  try {
    installClipboardTap();
  } catch {
    /* clipboard tap is best effort */
  }
  return runLoop(text, opts, {
    snapshot: () => buildSnapshot(),
    plan: makePlanner(opts.signal),
    execute: executeAction,
    rect: targetRect,
    resolveFollowup,
    sleep,
    stepDelayMs: STEP_DELAY_MS,
  });
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__deskhand = { runCommand, buildSnapshot, planWithRules };
}
