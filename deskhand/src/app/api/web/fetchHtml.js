// SSRF-safe HTML fetcher for the page reader. Node only.
// - every hop (first request and each redirect) is validated by parseSafeUrl
// - DNS is resolved and checked before the request, AND the socket is pinned to
//   a checked address through a custom lookup (defeats DNS rebinding)
// - redirects are followed manually, at most MAX_REDIRECTS
// - body is capped, decompressed incrementally, and must be html/xhtml
import { Buffer } from "node:buffer";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { isIP } from "node:net";
import { isHtmlContentType, isPrivateIp, parseSafeUrl, resolveRedirect } from "./safety.js";

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 4;
export const TOTAL_TIMEOUT_MS = 8000;
export const USER_AGENT =
  "Mozilla/5.0 (compatible; JarvisReader/1.0; reader view for the Jarvis web desktop demo)";

export class FetchError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const bareHost = (h) => (h.startsWith("[") ? h.slice(1, -1) : h);

/** Resolve a hostname and throw unless every address is public. */
export async function assertPublicHost(hostname) {
  const host = bareHost(hostname);
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new FetchError("blocked", "That address is private or internal and was blocked.");
    return;
  }
  let addrs;
  try {
    addrs = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new FetchError("dns_failed", "That site could not be found.");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address)))
    throw new FetchError("blocked", "That address resolves to a private or internal network and was blocked.");
}

/** Socket-level lookup: resolves again and refuses private results. */
function pinnedLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs?.length || addrs.some((a) => isPrivateIp(a.address)))
      return cb(new FetchError("blocked", "Blocked a private address at connect time."));
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

function decoderFor(encoding) {
  const e = String(encoding || "").toLowerCase().trim();
  if (e === "gzip" || e === "x-gzip") return zlib.createGunzip();
  if (e === "deflate") return zlib.createInflate();
  if (e === "br") return zlib.createBrotliDecompress();
  return null;
}

function requestOnce(urlStr, deadline) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === "https:" ? https : http;
    const left = deadline - Date.now();
    if (left <= 0) return reject(new FetchError("timeout", "The site took too long to respond."));
    const req = lib.request(
      u,
      {
        method: "GET",
        lookup: pinnedLookup,
        timeout: left,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "en;q=0.9",
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (res) => resolve(res),
    );
    req.on("timeout", () => req.destroy(new FetchError("timeout", "The site took too long to respond.")));
    req.on("error", (err) => reject(err instanceof FetchError ? err : mapNetError(err)));
    req.end();
  });
}

function mapNetError(err) {
  const code = err?.code || "";
  if (err instanceof FetchError) return err;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new FetchError("dns_failed", "That site could not be found.");
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EHOSTUNREACH" || code === "ENETUNREACH")
    return new FetchError("fetch_failed", "The site could not be reached.");
  if (/certificate|SSL|TLS|DEPTH_ZERO|CERT_/i.test(`${code} ${err?.message}`))
    return new FetchError("fetch_failed", "The site's security certificate was not accepted.");
  return new FetchError("fetch_failed", "The page could not be fetched.");
}

function readBody(res, deadline) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(arg);
    };
    const fail = (e) => {
      res.destroy();
      finish(reject, e);
    };
    const timer = setTimeout(
      () => fail(new FetchError("timeout", "The site took too long to send the page.")),
      Math.max(50, deadline - Date.now()),
    );
    const len = Number(res.headers["content-length"]);
    if (Number.isFinite(len) && len > MAX_BYTES && !res.headers["content-encoding"])
      return fail(new FetchError("too_large", "That page is larger than the 2 MB reader limit."));
    let stream = res;
    const dec = decoderFor(res.headers["content-encoding"]);
    if (dec) {
      dec.on("error", () => fail(new FetchError("fetch_failed", "The page could not be decoded.")));
      res.pipe(dec);
      stream = dec;
    }
    res.on("error", (e) => fail(mapNetError(e)));
    // Cap both compressed input (cheap) and decompressed output (zip bombs).
    let rawSize = 0;
    res.on("data", (c) => {
      rawSize += c.length;
      if (rawSize > MAX_BYTES) fail(new FetchError("too_large", "That page is larger than the 2 MB reader limit."));
    });
    stream.on("data", (c) => {
      size += c.length;
      if (size > MAX_BYTES) return fail(new FetchError("too_large", "That page is larger than the 2 MB reader limit."));
      chunks.push(c);
    });
    stream.on("end", () => finish(resolve, Buffer.concat(chunks)));
    stream.on("error", (e) => fail(mapNetError(e)));
  });
}

/** Pick a text decoder from the Content-Type charset or a <meta> sniff. */
export function decodeHtml(buf, contentType) {
  let charset = String(contentType || "").match(/charset\s*=\s*["']?([\w.:-]+)/i)?.[1];
  if (!charset) {
    const head = buf.subarray(0, 2048).toString("latin1");
    charset =
      head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i)?.[1] ||
      head.match(/<meta[^>]+content=["'][^"']*charset=([\w.:-]+)/i)?.[1];
  }
  try {
    return new TextDecoder(charset || "utf-8").decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

/**
 * Fetch a public HTML page.
 * @returns {Promise<{html:string, url:string, status:number, redirects:number}>}
 * @throws {FetchError}
 */
export async function fetchHtml(input) {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let check = parseSafeUrl(input);
  if (!check.ok) throw new FetchError(check.code, check.reason);
  let current = check.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const host = new URL(current).hostname;
    await assertPublicHost(host);
    const res = await requestOnce(current, deadline);
    const status = res.statusCode || 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      res.destroy();
      if (hop === MAX_REDIRECTS) throw new FetchError("too_many_redirects", "The site redirected too many times.");
      check = resolveRedirect(res.headers.location, current);
      if (!check.ok) throw new FetchError(check.code === "invalid" ? "fetch_failed" : "blocked", check.reason);
      current = check.url;
      continue;
    }
    if (status >= 400) {
      res.resume();
      res.destroy();
      if ([401, 403, 407, 429, 451, 999].includes(status))
        throw new FetchError("site_blocked", "This site blocked reading.", status);
      if (status === 404 || status === 410) throw new FetchError("not_found", "That page was not found.", status);
      throw new FetchError("upstream_error", `The site answered with HTTP ${status}.`, status);
    }
    if (status < 200 || status >= 300) {
      res.destroy();
      throw new FetchError("upstream_error", `The site answered with HTTP ${status}.`, status);
    }
    const ct = res.headers["content-type"];
    if (!isHtmlContentType(ct)) {
      res.destroy();
      throw new FetchError("not_html", "That link is not a web page (it is a file or media).", status);
    }
    const buf = await readBody(res, deadline);
    return { html: decodeHtml(buf, ct), url: current, status, redirects: hop };
  }
  throw new FetchError("too_many_redirects", "The site redirected too many times.");
}
