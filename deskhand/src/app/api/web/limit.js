// Best-effort per-IP rate limit and a tiny TTL cache for the web routes.
// In-memory only: on serverless each instance has its own counters.

const buckets = new Map();

export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64) || "unknown";
  return (req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

/** @returns {{ok:boolean, retryAfter:number}} */
export function rateLimit(name, ip, max, windowMs = 60_000) {
  const now = Date.now();
  const key = `${name}:${ip}`;
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 2000) buckets.delete(buckets.keys().next().value);
  return { ok: true, retryAfter: 0 };
}

export function makeCache(ttlMs, maxEntries) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      map.delete(key);
      return null;
    },
    set(key, value) {
      map.set(key, { at: Date.now(), value });
      if (map.size > maxEntries) map.delete(map.keys().next().value);
    },
  };
}
