const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 8000;
const NAME = /^[A-Za-z0-9._-]+$/;
const REF_PATH = /^[A-Za-z0-9._\-/@+~]+$/;

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Returns a raw.githubusercontent.com URL, or null if the input is not allowed. */
function toRawUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const parts = u.pathname.split("/").filter(Boolean);

  if (u.hostname === "raw.githubusercontent.com") {
    // /owner/repo/ref/path...
    if (parts.length < 4) return null;
    const [owner, repo, ...rest] = parts;
    if (!NAME.test(owner) || !NAME.test(repo) || !REF_PATH.test(rest.join("/"))) return null;
    if (rest.includes("..")) return null;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${rest.join("/")}`;
  }

  if (u.hostname === "github.com" || u.hostname === "www.github.com") {
    // /owner/repo/blob/ref/path...
    if (parts.length < 5 || parts[2] !== "blob") return null;
    const [owner, repo, , ...rest] = parts;
    if (!NAME.test(owner) || !NAME.test(repo) || !REF_PATH.test(rest.join("/"))) return null;
    if (rest.includes("..")) return null;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${rest.join("/")}`;
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return text("Missing ?url= parameter.", 400);

  const raw = toRawUrl(target.trim());
  if (!raw) {
    return text("Only github.com blob URLs and raw.githubusercontent.com URLs are accepted.", 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(raw, {
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
      headers: { accept: "text/plain, */*" },
    });
    if (!upstream.ok) return text(`GitHub responded with ${upstream.status}.`, upstream.status === 404 ? 404 : 502);

    const declared = Number(upstream.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return text("File is larger than 200KB.", 413);
    if (!upstream.body) return text("Empty response.", 502);

    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return text("File is larger than 200KB.", 413);
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.byteLength;
    }
    return text(new TextDecoder("utf-8").decode(buf), 200);
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return text(aborted ? "GitHub took too long to respond." : "Could not fetch the file.", aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
