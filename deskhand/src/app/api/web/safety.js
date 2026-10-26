// Pure URL and IP safety checks for the server-side page reader (SSRF defence).
// No framework imports: exercised by scripts/check-web.mjs under tsx.
import { isIP } from "node:net";

export const MAX_URL_LENGTH = 2048;
export const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/** @param {string} ip dotted IPv4 */
function ipv4ToParts(ip) {
  const m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

/** True for IPv4 addresses that must never be fetched. Unparseable input counts as blocked. */
export function isPrivateIPv4(ip) {
  const p = ipv4ToParts(ip);
  if (!p) return true;
  const [a, b, c] = p;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** Expand an IPv6 literal to 8 numeric hextets, or null when it is malformed. */
export function expandIPv6(input) {
  let s = String(input).toLowerCase().split("%")[0];
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  if (isIP(s) !== 6) return null;
  // Replace a dotted IPv4 tail with two hextets.
  const dotted = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const v4 = ipv4ToParts(dotted[2]);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    s = `${dotted[1]}${hi}:${lo}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = halves.length === 1 ? head : [...head, ...Array(missing).fill("0"), ...tail];
  const nums = all.map((h) => parseInt(h || "0", 16));
  return nums.length === 8 && nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff)
    ? nums
    : null;
}

const v4FromHextets = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

/** True for IPv6 addresses that must never be fetched (including v4-embedded forms). */
export function isPrivateIPv6(ip) {
  const h = expandIPv6(ip);
  if (!h) return true;
  if (h.every((n) => n === 0)) return true; // ::
  if (h.slice(0, 7).every((n) => n === 0) && h[7] === 1) return true; // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d)
  if (h.slice(0, 5).every((n) => n === 0) && (h[5] === 0xffff || h[5] === 0))
    return isPrivateIPv4(v4FromHextets(h[6], h[7]));
  // NAT64 64:ff9b::/96
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((n) => n === 0))
    return isPrivateIPv4(v4FromHextets(h[6], h[7]));
  // 6to4 2002::/16 embeds an IPv4 address
  if (h[0] === 0x2002) return isPrivateIPv4(v4FromHextets(h[1], h[2]));
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((h[0] & 0xff00) === 0xff00) return true; // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true; // documentation
  return false;
}

/** True when the address (v4 or v6 literal) points at a non-public destination. */
export function isPrivateIp(ip) {
  const s = String(ip ?? "").trim();
  const v = isIP(s.startsWith("[") ? s.slice(1, -1) : s);
  if (v === 4) return isPrivateIPv4(s);
  if (v === 6) return isPrivateIPv6(s);
  return true;
}

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".private",
  ".arpa",
];
const BLOCKED_NAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "kubernetes.default",
]);

/** Hostnames that are internal by name, before any DNS lookup. */
export function isBlockedHostname(hostname) {
  const h = String(hostname ?? "")
    .toLowerCase()
    .replace(/\.+$/, "");
  if (!h) return true;
  if (BLOCKED_NAMES.has(h)) return true;
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return true;
  const bare = h.startsWith("[") ? h.slice(1, -1) : h;
  if (isIP(bare)) return isPrivateIp(bare);
  // A single label ("intranet", "router") is never a public site.
  if (!h.includes(".")) return true;
  return false;
}

/**
 * Validate a user-supplied URL. Only absolute http(s) URLs on public hosts and
 * ordinary web ports, with no embedded credentials.
 * @returns {{ok:true, url:string, hostname:string} | {ok:false, code:"invalid"|"blocked", reason:string}}
 */
export function parseSafeUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, code: "invalid", reason: "No URL was given." };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, code: "invalid", reason: "The URL is too long." };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw))
    return { ok: false, code: "invalid", reason: "The URL contains control characters." };
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, code: "invalid", reason: "That is not a valid absolute URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { ok: false, code: "blocked", reason: "Only http and https pages can be read." };
  if (u.username || u.password)
    return { ok: false, code: "blocked", reason: "URLs with embedded credentials are not allowed." };
  if (!ALLOWED_PORTS.has(u.port))
    return { ok: false, code: "blocked", reason: `Port ${u.port} is not allowed.` };
  if (isBlockedHostname(u.hostname))
    return { ok: false, code: "blocked", reason: "That address is private or internal and was blocked." };
  u.hash = "";
  return { ok: true, url: u.toString(), hostname: u.hostname };
}

/** Resolve a redirect target against the current URL and validate it. */
export function resolveRedirect(location, currentUrl) {
  let next;
  try {
    next = new URL(String(location ?? ""), currentUrl).toString();
  } catch {
    return { ok: false, code: "invalid", reason: "The redirect target was not a valid URL." };
  }
  return parseSafeUrl(next);
}

/** Content types the reader accepts. */
export const isHtmlContentType = (ct) =>
  /^\s*(text\/html|application\/xhtml\+xml)\b/i.test(String(ct ?? ""));
