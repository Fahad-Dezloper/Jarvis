// Run: npm run check:web
// Known-answer checks for the real-web pieces: SSRF safety, search provider
// parsers, article extraction and sanitising. Needs no network and no keys.
import assert from "node:assert/strict";
import {
  isBlockedHostname,
  isHtmlContentType,
  isPrivateIp,
  parseSafeUrl,
  resolveRedirect,
} from "../src/app/api/web/safety.js";
import { assertPublicHost, fetchHtml } from "../src/app/api/web/fetchHtml.js";
import { extractArticle, sanitizeArticleHtml } from "../src/app/api/web/extract.js";
import { makeCache, rateLimit } from "../src/app/api/web/limit.js";
import {
  dedupeResults,
  interleave,
  parseBrave,
  parseGeminiGrounding,
  parseGoogleCse,
  parseHackerNews,
  parseMarginalia,
  parseWikipedia,
  relaxedQueries,
  stripTags,
} from "../src/app/api/web/providers.js";
import {
  formatResultsData,
  normalizeSource,
  pageUrl,
  parseInternalUrl,
  selectResult,
} from "../src/module/desktop/apps/chrome/searchCore.js";

let passed = 0;
let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${e.message}`);
  }
};

// ------------------------------------------------------------ IP safety
await check("private, loopback, link-local and metadata IPv4 are blocked", () => {
  for (const ip of [
    "0.0.0.0", "127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1",
    "172.31.255.255", "192.168.1.1", "169.254.169.254", "169.254.0.1", "100.64.0.1", "224.0.0.1",
    "255.255.255.255", "192.0.0.1", "198.18.0.1",
  ])
    assert.equal(isPrivateIp(ip), true, ip);
});
await check("public IPv4 are allowed, range edges are exact", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.255.255", "172.32.0.1", "192.167.1.1", "100.63.0.1", "11.0.0.1"])
    assert.equal(isPrivateIp(ip), false, ip);
});
await check("IPv6 loopback, unique-local, link-local, mapped and unspecified are blocked", () => {
  for (const ip of [
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::abcd%en0", "febf::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:10.1.2.3", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1",
    "2002:7f00:1::1", "2001:db8::1", "[::1]",
  ])
    assert.equal(isPrivateIp(ip), true, ip);
});
await check("public IPv6 and mapped public IPv4 are allowed", () => {
  for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "2a00:1450:4009:81f::200e"])
    assert.equal(isPrivateIp(ip), false, ip);
});
await check("garbage is treated as blocked, never allowed", () => {
  for (const ip of ["", "abc", "999.1.1.1", "1.2.3", "::g"]) assert.equal(isPrivateIp(ip), true, ip);
});

// ----------------------------------------------------------- URL safety
await check("hostnames: localhost, internal suffixes, single labels are blocked", () => {
  for (const h of ["localhost", "LOCALHOST", "foo.localhost", "printer.local", "metadata.google.internal", "db.internal", "intranet", "router", "x.corp", "localhost.", "1.0.0.127.in-addr.arpa", ""])
    assert.equal(isBlockedHostname(h), true, h);
  for (const h of ["example.com", "en.wikipedia.org", "sub.domain.co.uk", "93.184.216.34"])
    assert.equal(isBlockedHostname(h), false, h);
});
await check("parseSafeUrl accepts ordinary public http(s) URLs and strips the fragment", () => {
  const r = parseSafeUrl("https://en.wikipedia.org/wiki/Prediction_market#History");
  assert.equal(r.ok, true);
  assert.equal(r.url, "https://en.wikipedia.org/wiki/Prediction_market");
  assert.equal(parseSafeUrl("http://example.com:8080/x?y=1").ok, true);
  assert.equal(parseSafeUrl("  https://example.com  ").ok, true);
});
await check("parseSafeUrl rejects other schemes", () => {
  for (const u of ["file:///etc/passwd", "ftp://example.com/x", "javascript:alert(1)", "data:text/html,hi", "gopher://example.com", "ws://example.com", "chrome://newtab", "jarvis://page?url=x"]) {
    const r = parseSafeUrl(u);
    assert.equal(r.ok, false, u);
  }
});
await check("parseSafeUrl rejects credentials, odd ports, control chars, empty and oversize", () => {
  assert.equal(parseSafeUrl("https://user:pw@example.com/").ok, false);
  assert.equal(parseSafeUrl("https://user@example.com/").ok, false);
  assert.equal(parseSafeUrl("http://example.com:22/").ok, false);
  assert.equal(parseSafeUrl("http://example.com:6379/").ok, false);
  assert.equal(parseSafeUrl("https://exa\nmple.com/").ok, false);
  assert.equal(parseSafeUrl("").ok, false);
  assert.equal(parseSafeUrl(null).ok, false);
  assert.equal(parseSafeUrl("not a url").ok, false);
  assert.equal(parseSafeUrl(`https://example.com/${"a".repeat(2100)}`).ok, false);
});
await check("parseSafeUrl blocks private hosts in every spelling the URL parser normalises", () => {
  for (const u of [
    "http://localhost/", "http://127.0.0.1/", "http://127.1/", "http://2130706433/", "http://0x7f000001/",
    "http://0177.0.0.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/",
    "http://169.254.169.254/latest/meta-data/", "http://10.0.0.5/", "http://192.168.0.1/admin",
    "http://172.16.5.4/", "http://0.0.0.0/", "http://[fe80::1]/", "http://[fd00::1]/",
    "http://metadata.google.internal/computeMetadata/v1/", "http://localhost./", "http://app.localhost/",
  ]) {
    const r = parseSafeUrl(u);
    assert.equal(r.ok, false, u);
    assert.equal(r.code, "blocked", u);
  }
});
await check("redirect targets are re-validated (relative and absolute)", () => {
  assert.equal(resolveRedirect("/next", "https://example.com/a").url, "https://example.com/next");
  assert.equal(resolveRedirect("http://169.254.169.254/", "https://example.com/a").ok, false);
  assert.equal(resolveRedirect("//127.0.0.1/x", "https://example.com/a").ok, false);
  assert.equal(resolveRedirect("file:///etc/passwd", "https://example.com/a").ok, false);
  assert.equal(resolveRedirect("https://user:pw@example.com/", "https://example.com/a").ok, false);
  assert.equal(resolveRedirect("http://localhost:8080/", "https://example.com/a").ok, false);
});
await check("content type gate accepts html and xhtml only", () => {
  assert.equal(isHtmlContentType("text/html; charset=utf-8"), true);
  assert.equal(isHtmlContentType("application/xhtml+xml"), true);
  for (const c of ["application/pdf", "image/png", "application/json", "text/plain", "", undefined])
    assert.equal(isHtmlContentType(c), false, String(c));
});

// ------------------------------------------ fetcher refuses before connecting
await check("fetchHtml refuses private targets without opening a socket", async () => {
  for (const u of ["http://127.0.0.1:8080/", "http://localhost/", "http://169.254.169.254/", "http://[::1]/", "file:///etc/hosts", "https://u:p@example.com/"]) {
    await assert.rejects(() => fetchHtml(u), (e) => e.code === "blocked" || e.code === "invalid", u);
  }
});
await check("assertPublicHost rejects IP literals in private ranges", async () => {
  await assert.rejects(() => assertPublicHost("10.1.1.1"), (e) => e.code === "blocked");
  await assert.rejects(() => assertPublicHost("[::ffff:192.168.1.1]"), (e) => e.code === "blocked");
  await assertPublicHost("8.8.8.8");
});

// --------------------------------------------------------- extraction
const PAGE = `<!doctype html><html lang="en"><head>
<title>Fallback title</title>
<meta property="og:site_name" content="Example News">
<meta property="og:title" content="Why prediction markets matter">
<meta property="article:published_time" content="2026-10-20T09:30:00Z">
<meta name="author" content="Ada Lovelace">
<script>window.steal=document.cookie</script><style>body{display:none}</style>
</head><body onload="steal()">
<nav><a href="/home">Home</a><a href="/about">About</a></nav>
<article>
<h1>Why prediction markets matter</h1>
<p class="byline">By Ada Lovelace</p>
<p>Prediction markets aggregate dispersed information into a single price. This long paragraph exists so that the readability heuristics treat the block as the main article body of the page, with enough words to clear the character threshold comfortably and a little more besides.</p>
<p>A second paragraph discusses <a href="/research/markets">the research</a> and a <a href="https://other.example/paper#sec2" onclick="evil()">paper</a>, plus a <a href="javascript:alert(1)">bad link</a> and a <a href="mailto:a@b.example">mail link</a>.</p>
<p>Third paragraph with an image <img src="/img/chart.png" alt="A chart" onerror="evil()"> and an insecure one <img src="http://insecure.example/x.png"> and a tracker <img src="data:image/gif;base64,R0lGOD">.</p>
<iframe src="https://evil.example/frame"></iframe>
<form action="/post"><input name="x"><button>Go</button></form>
<script>alert('x')</script>
<pre><code>const a = 1 &lt; 2;</code></pre>
<table><tr><th>Market</th><th>Odds</th></tr><tr><td>Rain</td><td>30%</td></tr></table>
<blockquote>A quoted line.</blockquote>
<p>Final paragraph to make the article comfortably long enough for extraction. It repeats a few ideas about forecasting, price discovery, liquidity and incentives so the text length is realistic.</p>
</article>
<footer>Copyright</footer>
</body></html>`;

await check("extractArticle returns title, byline, site, date and clean text", () => {
  const a = extractArticle(PAGE, "https://news.example.com/2026/markets");
  assert.match(a.title, /prediction markets/i);
  assert.match(a.byline, /Ada Lovelace/);
  assert.equal(a.siteName, "Example News");
  assert.equal(a.date, "2026-10-20");
  assert.ok(a.text.includes("single price"));
  assert.ok(!a.text.includes("steal"), "script text must not leak");
  assert.ok(a.text.length <= 12000);
  assert.equal(a.url, "https://news.example.com/2026/markets");
});
await check("sanitised HTML has no scripts, styles, iframes, forms or event handlers", () => {
  const a = extractArticle(PAGE, "https://news.example.com/2026/markets");
  for (const bad of ["<script", "<style", "<iframe", "<form", "<input", "<button", "onclick", "onerror", "onload", "javascript:", "alert("])
    assert.ok(!a.html.toLowerCase().includes(bad), `found ${bad}`);
});
await check("links are absolute http(s) and images are https only", () => {
  const a = extractArticle(PAGE, "https://news.example.com/2026/markets");
  assert.ok(a.html.includes('href="https://news.example.com/research/markets"'));
  assert.ok(a.html.includes('href="https://other.example/paper#sec2"'));
  assert.ok(a.html.includes('src="https://news.example.com/img/chart.png"'));
  assert.ok(!a.html.includes("insecure.example"), "http image removed");
  assert.ok(!a.html.includes("data:image"), "data image removed");
  assert.ok(a.links.every((l) => /^https?:\/\//.test(l.url)));
  assert.ok(a.links.some((l) => l.text === "the research"));
});
await check("structure survives: pre/code, table, blockquote", () => {
  const a = extractArticle(PAGE, "https://news.example.com/2026/markets");
  assert.ok(/<pre>/.test(a.html) && /<code>/.test(a.html));
  assert.ok(/<table>/.test(a.html) && /<blockquote>/.test(a.html));
});
await check("sanitizeArticleHtml drops tags outside the allowlist but keeps their text", () => {
  const out = sanitizeArticleHtml(
    '<div class="x" style="color:red"><span id="s">hi</span> <svg><circle/></svg><video src="v.mp4"></video><a href="//evil.example/x">proto</a></div>',
    "https://site.example/",
  );
  assert.ok(!/<div|<span|<svg|<video|style=|class=/.test(out), out);
  assert.ok(out.includes("hi") && out.includes("proto"));
  assert.ok(!out.includes('href="//evil.example'), "protocol-relative href resolved safely or removed");
});
await check("extractArticle degrades gracefully on tiny or empty pages", () => {
  const empty = extractArticle("<html><body></body></html>", "https://example.com/");
  assert.equal(empty.html, "");
  assert.equal(empty.text, "");
  assert.equal(extractArticle("", "https://example.com/").title, "example.com");
  const tiny = extractArticle("<html><head><title>Hi</title></head><body><p>Short page.</p></body></html>", "https://example.com/x");
  assert.equal(tiny.title, "Hi");
  assert.ok(tiny.text.includes("Short page."));
});
await check("text is capped at 12000 characters and flagged", () => {
  const long = `<html><body><article>${"<p>Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor.</p>".repeat(400)}</article></body></html>`;
  const a = extractArticle(long, "https://example.com/long");
  assert.equal(a.text.length <= 12000, true);
  assert.equal(a.textTruncated, true);
});

// ------------------------------------------------------ search parsers
await check("Google CSE items map to results", () => {
  const r = parseGoogleCse({
    items: [{ title: "Prediction markets", link: "https://www.example.org/pm", displayLink: "www.example.org", snippet: "A <b>snippet</b>", pagemap: { metatags: [{ "article:published_time": "2026-09-01T00:00:00Z" }] } }],
  });
  assert.equal(r[0].site, "example.org");
  assert.equal(r[0].date, "2026-09-01");
  assert.equal(r[0].snippet, "A snippet");
  assert.equal(r[0].provider, "Google");
  assert.deepEqual(parseGoogleCse({}), []);
});
await check("Brave web and news payloads map to results", () => {
  const web = parseBrave({ web: { results: [{ title: "T", url: "https://a.example/x", description: "D", meta_url: { hostname: "www.a.example" }, page_age: "2026-10-01T10:00:00" }] } });
  assert.equal(web[0].site, "a.example");
  assert.equal(web[0].date, "2026-10-01");
  const news = parseBrave({ results: [{ title: "N", url: "https://n.example/y", description: "d" }] }, true);
  assert.equal(news[0].title, "N");
});
await check("Gemini grounding: sources become results, redirect-domain titles are tidied, supports give snippets", () => {
  const out = parseGeminiGrounding({
    text: "Markets aggregate beliefs. They are used for forecasting. Extra sentence.",
    sources: [
      { sourceType: "url", url: "https://site.example/blog/prediction-markets-explained", title: "site.example" },
      { sourceType: "url", url: "https://other.example/", title: "Real Title" },
      { sourceType: "document", url: "ignored" },
    ],
    groundingMetadata: { groundingSupports: [{ segment: { text: "Supported claim." }, groundingChunkIndices: [1] }] },
  });
  assert.equal(out.results.length, 2);
  assert.equal(out.results[0].title, "Prediction markets explained");
  assert.equal(out.results[0].site, "site.example");
  assert.ok(out.results[0].snippet.startsWith("Markets aggregate beliefs."));
  assert.equal(out.results[1].snippet, "Supported claim.");
  assert.ok(out.summary.length > 10);
});
await check("Wikipedia, Hacker News and Marginalia payloads map to results", () => {
  const w = parseWikipedia({ query: { search: [{ title: "Prediction market", snippet: 'A <span class="searchmatch">market</span> &amp; more' }] } });
  assert.equal(w[0].url, "https://en.wikipedia.org/wiki/Prediction_market");
  assert.equal(w[0].snippet, "A market & more");
  assert.equal(w[0].date, "");
  const hn = parseHackerNews({ hits: [{ title: "Ask HN", url: null, objectID: "42", created_at: "2026-10-25T08:00:00.000Z", points: 10, num_comments: 3 }, { title: "Story", url: "https://s.example/a", objectID: "43", created_at: "2026-10-01T00:00:00Z" }, { title: null, objectID: "9" }] });
  assert.equal(hn.length, 2);
  assert.equal(hn[0].url, "https://news.ycombinator.com/item?id=42");
  assert.equal(hn[0].date, "2026-10-25");
  assert.equal(hn[1].site, "s.example");
  const m = parseMarginalia({ results: [{ url: "https://small.example/", title: "Small", description: "d" }] });
  assert.equal(m[0].provider, "Marginalia");
});
await check("dedupe ignores tracking params, www and trailing slash; interleave keeps provider order", () => {
  const mk = (url) => ({ url, id: url });
  const d = dedupeResults([mk("https://www.a.example/x/?utm_source=z"), mk("https://a.example/x"), mk("ftp://bad.example/"), mk("https://b.example/")]);
  assert.deepEqual(d.map((r) => r.url), ["https://www.a.example/x/?utm_source=z", "https://b.example/"]);
  assert.deepEqual(interleave([[1, 2, 3], ["a"], ["x", "y"]]), [1, "a", "x", 2, "y", 3]);
});
await check("relaxedQueries drops filler and shortens long queries", () => {
  const q = relaxedQueries("search for the latest prediction market research");
  assert.equal(q[0], "search for the latest prediction market research");
  assert.equal(q[1], "prediction market research");
  assert.equal(relaxedQueries("a b c latest very long prediction market research")[2].split(" ").length, 3);
  assert.equal(relaxedQueries("rust").length, 1);
  assert.equal(stripTags("<b>a</b> &lt;b&gt;"), "a <b>");
});

// ---------------------------------------------- internal urls and selection
await check("page and search internal urls round-trip; sources normalise", () => {
  const u = pageUrl("https://example.com/a?b=1&c=2#x");
  assert.deepEqual(parseInternalUrl(u), { type: "page", url: "https://example.com/a?b=1&c=2#x" });
  assert.equal(parseInternalUrl("jarvis://search?q=a&source=news").source, "news");
  assert.equal(parseInternalUrl("jarvis://search?q=a&source=zzz").source, "web");
  assert.equal(normalizeSource("research papers"), "papers");
  assert.equal(normalizeSource("latest news"), "news");
  assert.equal(normalizeSource(undefined), "web");
});
await check("'latest' picks the newest dated result, else the first; result lines carry a snippet", () => {
  const list = [
    { title: "Old", date: "2026-01-01", url: "https://a.example/", snippet: "s1" },
    { title: "New", date: "2026-10-20", url: "https://b.example/", snippet: "s2" },
    { title: "Undated", date: "", url: "https://c.example/", snippet: "s3" },
  ];
  assert.equal(selectResult(list, "latest").result.title, "New");
  assert.equal(selectResult(list.map((r) => ({ ...r, date: "" })), "latest").index, 0);
  assert.equal(selectResult(list, "2").result.title, "New");
  assert.equal(selectResult(list, "undated").result.title, "Undated");
  const lines = formatResultsData(list).split("\n");
  assert.equal(lines[1], "2. New | 2026-10-20 | https://b.example/ | s2");
});

// ------------------------------------------------------ limiter and cache
await check("rate limiter blocks after the max and cache expires", async () => {
  const ip = `t-${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("t", ip, 3).ok, true);
  const blocked = rateLimit("t", ip, 3);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
  assert.equal(rateLimit("t", `${ip}-other`, 3).ok, true);
  const c = makeCache(20, 2);
  c.set("a", 1);
  assert.equal(c.get("a"), 1);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(c.get("a"), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
