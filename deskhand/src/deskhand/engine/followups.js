// Deterministic "finishers" for the offline rules path. A rules plan cannot see
// what its actions returned, so it carries a small serialisable `followup`
// descriptor; once the actions have run, resolveFollowup turns the recorded
// observations into the final reply. Replies are built only from observation
// text, never from assumptions. No aliases: runs under tsx and on the server.
import { truncate } from "./loop.js";

export const FOLLOWUP_KINDS = ["project_summary", "search_report", "answer"];

/** Accepts only the known descriptor shapes; anything else becomes null. */
export function sanitizeFollowup(f) {
  if (!f || typeof f !== "object" || !FOLLOWUP_KINDS.includes(f.kind)) return null;
  const out = { kind: f.kind };
  if (f.kind === "search_report") {
    out.opened = !!f.opened;
    if (f.read) out.read = true;
  }
  return out;
}

const lastWith = (obs, pred) => [...obs].reverse().find((o) => o.ok && pred(o));
const obsText = (o) => (o.data ? `${o.message}\n${o.data}` : o.message);
const clean = (s) => String(s).replace(/\s+/g, " ").trim();

/** Pull a short factual summary out of read_project text (README + package.json + file names). */
export function summarizeProject(data) {
  const text = String(data ?? "");
  if (!text.trim()) return "";
  const parts = [];

  const name = /"name"\s*:\s*"([^"]{1,80})"/.exec(text)?.[1];
  const desc = /"description"\s*:\s*"([^"]{3,240})"/.exec(text)?.[1];

  // README: first heading and first real paragraph after it
  let title = "";
  let para = "";
  const readmeAt = text.search(/readme(?:\.md)?/i);
  const scope = readmeAt >= 0 ? text.slice(readmeAt) : text;
  for (const raw of scope.split("\n")) {
    const l = raw.trim();
    if (!title) {
      const h = /^#\s+(.{2,100})$/.exec(l);
      if (h) title = clean(h[1]);
      continue;
    }
    if (!l || /^(#|```|\||[-*]\s|!\[|\[!\[|<|=|-{3,})/.test(l)) continue;
    if (l.length >= 30) {
      para = clean(l).slice(0, 300);
      break;
    }
  }

  const label = title || name;
  const what = para || desc;
  const endSentence = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
  if (label && what) parts.push(`This looks like ${label}: ${endSentence(what)}`);
  else if (label) parts.push(`This looks like a project called ${label}.`);
  else if (what) parts.push(`This project is described as: ${what}`);

  const depBlock = /"dependencies"\s*:\s*\{([^}]*)\}/.exec(text)?.[1];
  if (depBlock) {
    const deps = [...depBlock.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]).slice(0, 6);
    if (deps.length) parts.push(`It uses ${deps.join(", ")}.`);
  }
  const scripts = /"scripts"\s*:\s*\{([^}]*)\}/.exec(text)?.[1];
  if (scripts) {
    const names = [...scripts.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]).slice(0, 5);
    if (names.length) parts.push(`Scripts: ${names.join(", ")}.`);
  }

  const files = [...new Set([...text.matchAll(/^[\s#=>*-]*([\w./@-]+\.(?:jsx?|tsx?|py|rs|go|sol|json|md|css|html|mjs))\s*$/gm)].map((m) => m[1]))].slice(0, 8);
  if (files.length) parts.push(`Files include ${files.join(", ")}.`);

  if (!parts.length) {
    return `I read the project (${text.length} characters) but couldn't find a README or package description to summarise. It begins: ${truncate(clean(text), 200)}`;
  }
  return parts.join(" ");
}

function searchReply(obs, opened, read) {
  if (opened) {
    const o = lastWith(obs, (x) => /open_result/.test(x.action));
    if (o) {
      const raw = clean(obsText(o));
      const title = /Title:\s*(.+?)\s+(?:Date:|Source:|Authors?:|URL:)/.exec(raw)?.[1];
      const date = /Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(raw)?.[1];
      const source = /Source:\s*(.+?)\s+(?:URL:|Authors?:|Date:|$)/.exec(raw)?.[1];
      const page = read ? lastWith(obs, (x) => /read_page/.test(x.action) && x.data) : null;
      const pageText = page ? clean(page.data).slice(0, 350) : "";
      const tail = pageText ? ` I can't summarise offline; the page starts: ${pageText}` : "";
      if (title) {
        return truncate(`Opened "${title}"${date ? ` (${date})` : ""}${source ? ` from ${source}` : ""}.${tail}`, 600);
      }
      if (pageText) return truncate(`${raw} ${tail}`, 600);
      return truncate(raw, 400);
    }
  }
  const s = lastWith(obs, (x) => /browser\.search/.test(x.action));
  if (!s) return "";
  const lines = String(s.data ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);
  return truncate(`${clean(s.message)}${lines.length ? ` Top results: ${lines.join(" | ")}` : ""}`, 400);
}

/**
 * @param {{kind:string, opened?:boolean}} followup
 * @param {{action:string, ok:boolean, message:string, data?:string}[]} observations
 * @returns {{reply:string, done:boolean}}
 */
export function resolveFollowup(followup, observations) {
  const obs = observations ?? [];
  const fail = (what) => ({ reply: `I ran the steps but didn't get ${what} back.`, done: true });
  switch (followup?.kind) {
    case "project_summary": {
      const o = lastWith(obs, (x) => /read_project/.test(x.action) && x.data);
      if (!o) return fail("the project files");
      return { reply: summarizeProject(o.data), done: true };
    }
    case "search_report": {
      const r = searchReply(obs, !!followup.opened, !!followup.read);
      return r ? { reply: r, done: true } : fail("any search results");
    }
    case "answer": {
      const o = lastWith(obs, (x) => /^(calculator|weather|calendar|mail|desktop)\./.test(x.action));
      if (!o) return fail("an answer");
      const msg = clean(o.message);
      const data = o.data ? clean(o.data) : "";
      return { reply: truncate(data && !msg.includes(data) ? `${msg} ${data}` : msg, 500), done: true };
    }
    default: {
      const o = lastWith(obs, () => true);
      return { reply: o ? truncate(clean(obsText(o)), 400) : "Done.", done: true };
    }
  }
}
