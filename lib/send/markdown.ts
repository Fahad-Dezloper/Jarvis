import type { BriefOutput } from "../types";

export interface BriefMeta {
  componentName: string;
  /** ISO date string; defaults to now. */
  generatedAt?: string;
}

function formatTime(ms: number | null): string {
  if (ms === null) return "n/a";
  return `${(ms / 1000).toFixed(2)}s`;
}

function cell(s: string | null | undefined): string {
  return (s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim() || "-";
}

/** A fence longer than any backtick run inside the text. */
function fenceFor(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
  return "`".repeat(Math.max(3, longest + 1));
}

export function buildBriefMarkdown(brief: BriefOutput, meta: BriefMeta): string {
  const lines: string[] = [];
  lines.push(`# Motion brief: ${meta.componentName}`, "");
  const date = (meta.generatedAt ?? new Date().toISOString()).slice(0, 10);
  lines.push(`_Generated ${date} by Motion Brief (${brief.source === "model" ? "model" : "heuristic"} draft)._`, "");
  lines.push("## Summary", "", brief.summary.trim(), "");

  lines.push("## Issues", "");
  if (brief.issues.length === 0) {
    lines.push("No specific issues were extracted.", "");
  } else {
    lines.push("| # | Time | Selector | Current | Target |", "|---|------|----------|---------|--------|");
    brief.issues.forEach((i, n) => {
      lines.push(`| ${n + 1} | ${formatTime(i.timeMs)} | ${cell(i.selector)} | ${cell(i.currentValues)} | ${cell(i.target)} |`);
    });
    lines.push("");
    brief.issues.forEach((i, n) => {
      lines.push(`### ${n + 1}. ${i.problem.trim()}`, "");
      lines.push(`- **Time:** ${formatTime(i.timeMs)}`);
      lines.push(`- **Selector:** ${i.selector ? `\`${i.selector}\`` : "n/a"}`);
      lines.push(`- **Current:** ${i.currentValues}`);
      lines.push(`- **Target:** ${i.target}`);
      lines.push(`- **Suggested change:** ${i.suggestedChange}`, "");
    });
  }

  lines.push("## Constraints", "");
  if (brief.constraints.length === 0) lines.push("None specified.");
  else brief.constraints.forEach((c) => lines.push(`- ${c}`));
  lines.push("");

  const fence = fenceFor(brief.prompt);
  lines.push("## Full prompt", "", `${fence}text`, brief.prompt, fence, "");
  return lines.join("\n");
}

/** Safe, predictable file name; the default is MOTION_BRIEF.md. */
export function safeBriefFileName(componentName?: string): string {
  const slug = (componentName ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug ? `MOTION_BRIEF_${slug}.md` : "MOTION_BRIEF.md";
}
