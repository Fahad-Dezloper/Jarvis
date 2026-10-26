import { NextResponse } from "next/server";
import { cleanQuery } from "../../../module/desktop/apps/chrome/searchCore.js";
import { clientIp, rateLimit } from "../web/limit.js";
import { searchWeb } from "../web/providers.js";

// GET /api/search?q=&source=papers|web|weather
// web | news | papers: delegates to the provider chain in ../web/providers.js
// (the app itself calls /api/web/search; this route is kept for older callers).
// weather: a condensed wttr.in reading.
// Server-side so the browser never needs CORS access.

export const dynamic = "force-dynamic";

const CACHE_MS = 5 * 60_000;
const cache = new Map();

const getCached = (key) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  cache.delete(key);
  return null;
};
const setCached = (key, value) => {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
};

async function timedFetch(url, ms, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function weather(city) {
  const res = await timedFetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, 5000, {
    headers: { "user-agent": "jarvis-demo" },
  });
  if (!res.ok) throw new Error(`wttr.in ${res.status}`);
  const j = await res.json();
  const cur = j.current_condition?.[0];
  if (!cur) throw new Error("no current condition");
  return {
    city: city.replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()),
    country: j.nearest_area?.[0]?.country?.[0]?.value || "",
    condition: cur.weatherDesc?.[0]?.value || "Clear",
    tempC: Number(cur.temp_C),
    tempF: Number(cur.temp_F),
    feelsC: Number(cur.FeelsLikeC),
    feelsF: Number(cur.FeelsLikeF),
    humidity: Number(cur.humidity),
    windKmph: Number(cur.windspeedKmph),
    highC: Number(j.weather?.[0]?.maxtempC),
    lowC: Number(j.weather?.[0]?.mintempC),
    highF: Number(j.weather?.[0]?.maxtempF),
    lowF: Number(j.weather?.[0]?.mintempF),
  };
}

export async function GET(req) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "web";
  const q = cleanQuery(url.searchParams.get("q"));
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  if (!["papers", "web", "news", "weather"].includes(source)) {
    return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  }

  if (source !== "weather" && !rateLimit("search", clientIp(req), 60).ok)
    return NextResponse.json({ error: "Too many searches. Try again shortly." }, { status: 429 });

  const key = `${source}:${q.toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  try {
    if (source === "weather") {
      if (!/^[\p{L}\p{M}\s.,'-]{1,80}$/u.test(q)) {
        return NextResponse.json({ error: "Invalid city" }, { status: 400 });
      }
      const data = await weather(q);
      const value = { source, data };
      setCached(key, value);
      return NextResponse.json(value);
    }

    const value = await searchWeb(q, source);
    // Do not cache an offline answer so the next try can reach the network.
    if (!value.offline) setCached(key, value);
    return NextResponse.json(value);
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 502 });
  }
}
