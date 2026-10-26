import { NextResponse } from "next/server";
import { MAX_QUERY, cleanQuery } from "../../../../module/desktop/apps/chrome/searchCore.js";
import { clientIp, makeCache, rateLimit } from "../limit.js";
import { searchWeb } from "../providers.js";

// GET /api/web/search?q=&source=web|papers|news
// Provider chain (first that answers wins): Google Programmable Search, Brave,
// Gemini Google-Search grounding, then keyless sources (Wikipedia, Hacker News,
// Marginalia, arXiv). Server side only: keys never reach the browser.
// Returns { provider, results: [{ title, url, site, snippet, date? }], ... }.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = makeCache(5 * 60_000, 200);

export async function GET(req) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "web";
  const rawQ = String(url.searchParams.get("q") ?? "");
  if (rawQ.length > MAX_QUERY * 2)
    return NextResponse.json({ error: `Query is too long (max ${MAX_QUERY} characters).` }, { status: 400 });
  const q = cleanQuery(rawQ);
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  if (q.length >= MAX_QUERY && rawQ.trim().length > MAX_QUERY)
    return NextResponse.json({ error: `Query is too long (max ${MAX_QUERY} characters).` }, { status: 400 });
  if (!["web", "papers", "news"].includes(source))
    return NextResponse.json({ error: "Unknown source" }, { status: 400 });

  const lim = rateLimit("search", clientIp(req), 60);
  if (!lim.ok)
    return NextResponse.json(
      { error: "Too many searches. Try again shortly." },
      { status: 429, headers: { "retry-after": String(lim.retryAfter) } },
    );

  const key = `${source}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  try {
    const value = await searchWeb(q, source, { totalMs: 8000 });
    // Never cache an offline answer: the next try should reach the network.
    if (!value.offline) cache.set(key, value);
    return NextResponse.json(value, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 502 });
  }
}
