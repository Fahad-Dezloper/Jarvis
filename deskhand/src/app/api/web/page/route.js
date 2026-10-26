import { NextResponse } from "next/server";
import { extractArticle } from "../extract.js";
import { FetchError, fetchHtml } from "../fetchHtml.js";
import { clientIp, makeCache, rateLimit } from "../limit.js";
import { parseSafeUrl } from "../safety.js";

// GET /api/web/page?url=
// Server-side reader: fetches a public page (SSRF-guarded), extracts the article
// with Readability and returns sanitized HTML plus plain text. The browser never
// talks to the target site, so framing headers (X-Frame-Options/CSP) do not matter.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = makeCache(5 * 60_000, 60);

const STATUS = {
  invalid: 400,
  blocked: 403,
  site_blocked: 502,
  not_found: 404,
  not_html: 415,
  too_large: 413,
  timeout: 504,
  dns_failed: 502,
  too_many_redirects: 508,
  upstream_error: 502,
  fetch_failed: 502,
};

const fail = (code, message, extra = {}) =>
  NextResponse.json(
    { ok: false, error: code, message, ...extra },
    { status: STATUS[code] || 500, headers: { "cache-control": "no-store" } },
  );

export async function GET(req) {
  const ip = clientIp(req);
  const lim = rateLimit("page", ip, 40);
  if (!lim.ok)
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many page loads. Try again shortly." },
      { status: 429, headers: { "retry-after": String(lim.retryAfter) } },
    );

  const raw = new URL(req.url).searchParams.get("url");
  const check = parseSafeUrl(raw);
  if (!check.ok) return fail(check.code, check.reason);

  const hit = cache.get(check.url);
  if (hit) return NextResponse.json({ ...hit, cached: true }, { headers: { "cache-control": "no-store" } });

  try {
    const page = await fetchHtml(check.url);
    const article = extractArticle(page.html, page.url);
    const value = { ok: true, ...article, requestedUrl: check.url, redirects: page.redirects };
    cache.set(check.url, value);
    return NextResponse.json(value, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof FetchError) return fail(err.code, err.message, err.status ? { upstream: err.status } : {});
    return fail("fetch_failed", "The page could not be read.");
  }
}
