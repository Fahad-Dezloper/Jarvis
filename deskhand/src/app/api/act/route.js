import { NextResponse } from "next/server";
import { sanitizeFollowup } from "../../../deskhand/engine/followups.js";
import { cleanObservations, summarizeObservations } from "../../../deskhand/engine/loop.js";
import { hasKey, planWithModel } from "../../../deskhand/engine/model.js";
import { planWithRules } from "../../../deskhand/engine/rules.js";
import { sanitizeActions } from "../../../deskhand/engine/schema.js";
import { trimSnapshot } from "../../../deskhand/engine/snapshot-core.js";

export const maxDuration = 60;

// Best-effort rate limit: an in-memory sliding window per IP. On serverless
// every instance has its own memory, so this only slows a single hot instance;
// it is not a hard guarantee. One voice task uses several rounds, so the
// window is wider than one request per command.
const LIMIT = 30;
const WINDOW_MS = 60_000;
const hits = new Map();

// Hard cap on model calls for one command (same caveat: per instance memory).
const MAX_MODEL_CALLS_PER_COMMAND = 8;
const COMMAND_TTL_MS = 3 * 60_000;
const commandCalls = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

/** Count a model call for this command; true when the per-command cap is already reached. */
function commandCapped(key) {
  const now = Date.now();
  const e = commandCalls.get(key);
  if (!e || now - e.t > COMMAND_TTL_MS) {
    commandCalls.set(key, { n: 1, t: now });
  } else {
    if (e.n >= MAX_MODEL_CALLS_PER_COMMAND) return true;
    e.n++;
  }
  if (commandCalls.size > 5000) for (const [k, v] of commandCalls) if (now - v.t > COMMAND_TTL_MS) commandCalls.delete(k);
  return false;
}

const clientIp = (req) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";

function cleanHistory(h) {
  return (Array.isArray(h) ? h : [])
    .filter((x) => x && typeof x.command === "string")
    .slice(-6)
    .map((x) => ({ command: x.command.slice(0, 300), reply: String(x.reply ?? "").slice(0, 300) }));
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const command = typeof body?.command === "string" ? body.command.trim().slice(0, 800) : "";
  if (!command) return NextResponse.json({ error: "Say what you want done." }, { status: 400 });

  const ip = clientIp(req);
  if (limited(ip)) {
    return NextResponse.json({ error: "Too many commands. Try again in a minute." }, { status: 429 });
  }

  const snapshot = trimSnapshot(body.snapshot);
  const history = cleanHistory(body.history);
  const observations = cleanObservations(body.observations);
  const round = Number.isFinite(body.round) ? Math.max(1, Math.min(20, Math.round(body.round))) : 1;
  const commandId = typeof body.commandId === "string" ? body.commandId.replace(/[^\w-]/g, "").slice(0, 64) : "";

  // Later rounds only exist for the model path; the rules path resolves its
  // follow-ups on the client. Without a usable model, wrap up from what we have.
  const wrapUp = (note) => {
    const summary = summarizeObservations(observations);
    return NextResponse.json({
      actions: [],
      done: true,
      reply: summary ? `I couldn't plan further. ${summary}` : "I couldn't plan the next step.",
      source: "rules",
      note,
    });
  };
  const rulesPlan = (note) => {
    const plan = planWithRules(command, { snapshot, history, note });
    return NextResponse.json({ ...plan, actions: sanitizeActions(plan.actions), followup: sanitizeFollowup(plan.followup) ?? undefined });
  };

  if (!hasKey()) {
    const note = "The AI model is not configured, so the offline rules planned this.";
    return round > 1 ? wrapUp(note) : rulesPlan(note);
  }

  if (commandCapped(`${ip}:${commandId || command.slice(0, 80)}`)) {
    return NextResponse.json({ error: "That task needed too many AI steps. Try a simpler request." }, { status: 429 });
  }

  try {
    const plan = await planWithModel({ command, snapshot, history, observations, round });
    return NextResponse.json({ ...plan, actions: sanitizeActions(plan.actions) });
  } catch (e) {
    const note =
      e?.message === "model quota"
        ? "The AI model's free quota is used up right now (HTTP 429), so the offline rules planned this. Quota usually returns within a few minutes."
        : e?.message === "model timed out"
          ? "The AI model timed out, so the offline rules planned this."
          : "The AI model was unavailable, so the offline rules planned this.";
    return round > 1 ? wrapUp(note) : rulesPlan(note);
  }
}
