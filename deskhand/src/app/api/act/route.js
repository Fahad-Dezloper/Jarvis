import { NextResponse } from "next/server";
import { hasKey, planWithModel } from "../../../deskhand/engine/model.js";
import { planWithRules } from "../../../deskhand/engine/rules.js";
import { sanitizeActions } from "../../../deskhand/engine/schema.js";
import { trimSnapshot } from "../../../deskhand/engine/snapshot-core.js";

export const maxDuration = 60;

// Best-effort rate limit: an in-memory sliding window per IP. On serverless
// every instance has its own memory, so this only slows a single hot instance;
// it is not a hard guarantee.
const LIMIT = 20;
const WINDOW_MS = 60_000;
const hits = new Map();

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

  if (limited(clientIp(req))) {
    return NextResponse.json({ error: "Too many commands. Try again in a minute." }, { status: 429 });
  }

  const snapshot = trimSnapshot(body.snapshot);
  const history = cleanHistory(body.history);

  if (!hasKey()) {
    const plan = planWithRules(command, { snapshot, history, note: "The AI model is not configured, so the offline rules planned this." });
    return NextResponse.json(plan);
  }

  try {
    const plan = await planWithModel({ command, snapshot, history });
    return NextResponse.json({ ...plan, actions: sanitizeActions(plan.actions) });
  } catch (e) {
    const plan = planWithRules(command, { snapshot, history, note: `The AI model ${e?.message === "model timed out" ? "timed out" : "was unavailable"}, so the offline rules planned this.` });
    return NextResponse.json(plan);
  }
}
