import { briefInputSchema } from "@/lib/brief/schema";
import { buildHeuristicBrief } from "@/lib/brief/heuristic";
import { generateBriefWithModel, resolveApiKey } from "@/lib/brief/model";
import type { BriefOutput } from "@/lib/types";

export const maxDuration = 60;

// Best-effort per-IP rate limit. State lives in this instance's memory, so on
// serverless platforms each instance counts separately and cold starts reset
// it. It only deters casual abuse; it is not a security boundary.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_REQUESTS;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function GET() {
  return Response.json({ modelAvailable: resolveApiKey() !== null });
}

export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  const parsed = briefInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid input.",
        issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const apiKey = resolveApiKey(req.headers.get("x-anthropic-key"));
  if (!apiKey) {
    return Response.json(buildHeuristicBrief(input) satisfies BriefOutput);
  }

  try {
    const out = await generateBriefWithModel(input, apiKey);
    return Response.json(out);
  } catch {
    const fallback = buildHeuristicBrief(input);
    return Response.json({
      ...fallback,
      note: "The model request failed, so this brief was built by the offline heuristic instead.",
    });
  }
}
