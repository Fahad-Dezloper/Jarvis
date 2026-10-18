// Run: npm run check:send
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  claudeCliCommand, claudeCodeDeeplink, claudeWebLink, cursorDeeplink,
  shellQuote, shortPromptReferencingFile, CURSOR_URL_LIMIT, CLAUDE_CODE_Q_LIMIT,
} from "../lib/send/links";
import { buildBriefMarkdown, safeBriefFileName } from "../lib/send/markdown";
import type { BriefOutput } from "../lib/types";

const nasty = [
  "plain text",
  "a & b = c",
  "1 + 1 = 2 and spaces  double",
  "100% sure %41 %",
  "line1\nline2\r\nline3",
  "unicode: café 日本語 🎬 — “quotes”",
  "it's `tick` $HOME $(whoami) \"dq\" \\ back\\slash ! #hash ?q=1&x=2",
];

// Cursor / Claude link encoding round-trips
for (const p of nasty) {
  const c = cursorDeeplink(p);
  for (const url of [c.web, c.app]) {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("text"), p, `cursor roundtrip: ${p}`);
    assert.equal(parsed.searchParams.getAll("text").length, 1);
  }
  assert.ok(!c.web.includes("+"), "no raw plus");
  assert.ok(!c.web.split("?text=")[1].includes("&"), "no raw ampersand");
  assert.equal(c.web.startsWith("https://cursor.com/link/prompt?text="), true);
  assert.equal(c.app.startsWith("cursor://anysphere.cursor-deeplink/prompt?text="), true);

  const cc = claudeCodeDeeplink(p, { repo: "acme/app" });
  const u = new URL(cc.url);
  assert.equal(u.searchParams.get("q"), p);
  assert.equal(u.searchParams.get("repo"), "acme/app");
  assert.equal(new URL(claudeWebLink(p)).searchParams.get("q"), p);
}
assert.ok(cursorDeeplink("a\nb").web.endsWith("a%0Ab"));
assert.ok(claudeCodeDeeplink("a\nb").url.includes("q=a%0Ab"));
assert.ok(cursorDeeplink("a b").web.endsWith("a%20b"));

// cwd wins over repo
const both = claudeCodeDeeplink("x", { repo: "a/b", cwd: "/Users/me/my app" });
assert.ok(both.url.includes("cwd=%2FUsers%2Fme%2Fmy%20app"));
assert.ok(!both.url.includes("repo="));
assert.ok(claudeCodeDeeplink("x").url.startsWith("claude-cli://open?q="));

// Limits
assert.equal(CURSOR_URL_LIMIT, 8000);
assert.equal(CLAUDE_CODE_Q_LIMIT, 5000);
assert.equal(cursorDeeplink("a".repeat(100)).fits, true);
const overhead = cursorDeeplink("").encodedLength;
assert.equal(cursorDeeplink("a".repeat(CURSOR_URL_LIMIT - overhead)).fits, true);
assert.equal(cursorDeeplink("a".repeat(CURSOR_URL_LIMIT - overhead + 1)).fits, false);
assert.equal(cursorDeeplink("\n".repeat(3000)).fits, false); // 9000 encoded chars
assert.equal(claudeCodeDeeplink("a".repeat(5000)).fits, true);
assert.equal(claudeCodeDeeplink("a".repeat(5001)).fits, false);
assert.equal(claudeCodeDeeplink("\n".repeat(1700)).fits, false); // encoded 5100

// Short prompt
const sp = shortPromptReferencingFile("MOTION_BRIEF.md");
assert.ok(sp.includes("MOTION_BRIEF.md") && sp.length < 200);
assert.equal(cursorDeeplink(sp).fits && claudeCodeDeeplink(sp).fits, true);

// Shell quoting: verify with a real POSIX shell
assert.equal(shellQuote("abc"), "'abc'");
assert.equal(shellQuote("it's"), `'it'\\''s'`);
for (const p of [...nasty, "'", "''", "'; rm -rf / #", "end with quote'", "\n", "", "multi\nline 'with' $VAR `cmd` \\n"]) {
  const out = execFileSync("/bin/sh", ["-c", `printf %s ${shellQuote(p)}`], { encoding: "utf8" });
  assert.equal(out, p, `shell roundtrip: ${JSON.stringify(p)}`);
  assert.equal(claudeCliCommand(p), `claude ${shellQuote(p)}`);
}
// The command passes exactly one argument
const argc = execFileSync("/bin/sh", ["-c", `set -- ${shellQuote("a b 'c' $d\n")}; echo $#`], { encoding: "utf8" });
assert.equal(argc.trim(), "1");

// Markdown
const brief: BriefOutput = {
  summary: "Logo overshoots.",
  issues: [
    { timeMs: 700, selector: ".logo", problem: "Overshoot", currentValues: "900ms | spring", target: "soft\nsettle", suggestedChange: "Use ease-out" },
    { timeMs: null, selector: null, problem: "General", currentValues: "x", target: "y", suggestedChange: "z" },
  ],
  constraints: ["Under 2s"],
  prompt: "Do the thing\n```js\ncode()\n```",
  source: "model",
};
const md = buildBriefMarkdown(brief, { componentName: "Hero", generatedAt: "2026-01-02T00:00:00Z" });
assert.ok(md.startsWith("# Motion brief: Hero"));
for (const s of ["## Summary", "## Issues", "## Constraints", "## Full prompt", "0.70s", "`.logo`", "900ms \\| spring", "Under 2s", "2026-01-02"]) {
  assert.ok(md.includes(s), `markdown has ${s}`);
}
assert.ok(md.includes("````text\nDo the thing\n```js\ncode()\n```\n````"), "fence longer than inner fence");
assert.ok(!md.split("\n").some((l) => l.startsWith("|") && l.includes("soft\nsettle")));
const empty = buildBriefMarkdown({ ...brief, issues: [], constraints: [] }, { componentName: "X" });
assert.ok(empty.includes("No specific issues") && empty.includes("None specified."));

// File names
assert.equal(safeBriefFileName(), "MOTION_BRIEF.md");
assert.equal(safeBriefFileName("Hero"), "MOTION_BRIEF_Hero.md");
assert.equal(safeBriefFileName("../../etc/passwd"), "MOTION_BRIEF_etc_passwd.md");
assert.equal(safeBriefFileName("日本語"), "MOTION_BRIEF.md");
assert.ok(safeBriefFileName("a".repeat(200)).length < 70);

console.log("check-send: all assertions passed");
