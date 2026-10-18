import type { AnimationInfo, BriefInput, BriefIssue, BriefOutput, Pin } from "@/lib/types";
import { detectVocabulary, type VocabMatch } from "./vocabulary";

/**
 * Deterministic no-key fallback. Builds a structured brief from pins,
 * narration, the motion glossary and measured values. It only states numbers
 * that were measured or found in the supplied code; glossary ranges are
 * labelled as suggestions.
 */

export type Phase = "before" | "during" | "after" | "unknown";

const FIXED_CONSTRAINTS = [
  "Do not change unrelated behaviour, layout, copy, or styling.",
  "Change only the animation values needed for the issues listed; keep the public API and props of the component the same.",
  "Keep the existing animation library; do not add dependencies.",
  "Animate transform and opacity where possible; do not animate layout properties.",
  "Respect prefers-reduced-motion if the component already does; do not remove it.",
  "Values marked as suggestions are starting points: tune them by playing the animation, and report the final values.",
];

// ---------- text helpers ----------

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\s*\n\s*|;\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

const TIME_RE = /\b(?:at|around|about|near|by)?\s*(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?)\b/i;

/** Pull an explicit time like "at 1.2 seconds" or "around 800ms". */
export function extractTimeMs(sentence: string): number | null {
  const m = sentence.match(TIME_RE);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return /^m/i.test(m[2]) ? Math.round(n) : Math.round(n * 1000);
}

export function phaseFromCue(sentence: string): Phase {
  const s = sentence.toLowerCase();
  if (/\b(before|at the start|at the beginning|initially|to begin with|first frame|starts? (?:at|with|from))\b/.test(s)) return "before";
  if (/\b(after|at the end|once it|when it(?:'s| is)? done|finally|ends? (?:at|with|up)|lands?|settles?|comes? to rest)\b/.test(s)) return "after";
  if (/\b(at this point|right here|here it|during|while|as it|halfway|mid(?:dle|way)?|in the middle|then it|and then)\b/.test(s)) return "during";
  return "unknown";
}

function nameTokens(selector: string): string[] {
  return selector
    .split(/[^a-zA-Z0-9]+/)
    .filter((t) => t.length > 2 && !/^(div|span|the|svg|path|nth|child|first|last)$/i.test(t))
    .map((t) => t.toLowerCase());
}

function sentenceSelector(sentence: string, input: BriefInput): string | null {
  const s = sentence.toLowerCase();
  const selectors = new Set<string>();
  for (const a of input.animations) if (a.selector) selectors.add(a.selector);
  for (const p of input.pins) if (p.selector) selectors.add(p.selector);
  for (const sel of selectors) {
    if (nameTokens(sel).some((t) => new RegExp(`\\b${t}s?\\b`).test(s))) return sel;
  }
  return null;
}

// ---------- measured values ----------

export function describeAnimation(a: AnimationInfo): string {
  const parts = [
    `${a.kind} "${a.label}"`,
    `duration ${Math.round(a.durationMs)}ms`,
    `delay ${Math.round(a.delayMs)}ms`,
    `easing ${a.easing || "unknown"}`,
  ];
  if (a.iterations !== 1) parts.push(`iterations ${a.iterations}`);
  if (a.properties.length) parts.push(`properties ${a.properties.join(", ")}`);
  return parts.join(", ");
}

function activeWindow(a: AnimationInfo): [number, number] {
  const iter = Number.isFinite(a.iterations) ? a.iterations : 1;
  return [a.delayMs, a.delayMs + a.durationMs * iter];
}

function animationsFor(timeMs: number | null, selector: string | null, input: BriefInput, pin?: Pin): AnimationInfo[] {
  if (pin?.measured?.length) return pin.measured;
  let pool = input.animations;
  if (selector) {
    const bySel = pool.filter((a) => a.selector === selector);
    if (bySel.length) pool = bySel;
  }
  if (timeMs != null) {
    const near = pool.filter((a) => {
      const [s, e] = activeWindow(a);
      return timeMs >= s - 150 && timeMs <= e + 150;
    });
    if (near.length) return near;
  }
  return selector ? pool : [];
}

function phaseFromTime(timeMs: number | null, anims: AnimationInfo[]): Phase {
  if (timeMs == null || !anims.length) return "unknown";
  const start = Math.min(...anims.map((a) => activeWindow(a)[0]));
  const end = Math.max(...anims.map((a) => activeWindow(a)[1]));
  if (timeMs < start) return "before";
  if (timeMs > end) return "after";
  return "during";
}

/** Parse cubic-bezier(x1,y1,x2,y2) to detect built-in overshoot. */
function bezierOvershoots(easing: string): boolean {
  const m = easing.match(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  if (!m) return /back|elastic|bounce|spring/i.test(easing);
  const y1 = parseFloat(m[2]);
  const y2 = parseFloat(m[4]);
  return y1 > 1 || y2 > 1 || y1 < 0 || y2 < 0;
}

// ---------- code scanning ----------

const CODE_KEY_RE = /\b(duration|delay|ease|easing|stagger|stiffness|damping|mass|bounce|transition|animation|keyframes|spring|cubic-bezier|repeat)\b/i;

export interface CodeHit {
  file: string;
  line: number;
  text: string;
}

export function findCodeHits(files: Record<string, string>, selector: string | null, max = 12): CodeHit[] {
  const tokens = selector ? nameTokens(selector) : [];
  const hits: CodeHit[] = [];
  for (const [file, src] of Object.entries(files)) {
    const lines = src.split("\n");
    lines.forEach((text, i) => {
      if (!CODE_KEY_RE.test(text)) return;
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 200) return;
      hits.push({ file, line: i + 1, text: trimmed });
    });
  }
  if (!tokens.length) return hits.slice(0, max);
  // Prefer lines in a window around a selector-token mention, else global hits.
  const near: CodeHit[] = [];
  for (const [file, src] of Object.entries(files)) {
    const lines = src.split("\n");
    lines.forEach((text, i) => {
      if (!tokens.some((t) => text.toLowerCase().includes(t))) return;
      for (let j = Math.max(0, i - 6); j <= Math.min(lines.length - 1, i + 12); j++) {
        if (CODE_KEY_RE.test(lines[j]) && lines[j].trim().length <= 200) {
          near.push({ file, line: j + 1, text: lines[j].trim() });
        }
      }
    });
  }
  const seen = new Set<string>();
  const uniq = (near.length ? near : hits).filter((h) => {
    const k = `${h.file}:${h.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.slice(0, max);
}

// ---------- issue building ----------

function suggestFor(matches: VocabMatch[], anims: AnimationInfo[]): { target: string; change: string } {
  if (!matches.length) {
    return {
      target: "Behaviour described in the note; no glossary term recognised, so no numeric target is proposed.",
      change: "Adjust the animation as described in the note. No numeric suggestion is made because none can be derived without guessing.",
    };
  }
  const targets: string[] = [];
  const changes: string[] = [];
  for (const { entry, hits } of matches) {
    targets.push(`"${hits[0]}" -> ${entry.meaning}`);
    let c = `${entry.direction}`;
    const tools = [entry.css && `CSS: ${entry.css}`, entry.gsap && `GSAP: ${entry.gsap}`, entry.motion && `Motion: ${entry.motion}`].filter(Boolean);
    if (tools.length) c += ` Suggested (not measured): ${tools.join(" | ")}.`;
    // Tie suggestions to measured facts where we can.
    if (entry.id === "overshoot") {
      const over = anims.filter((a) => bezierOvershoots(a.easing));
      if (over.length) c += ` Measured easing ${over.map((a) => `"${a.easing}"`).join(", ")} overshoots by construction; this is the likely source.`;
    }
    if (entry.id === "sluggish" || entry.id === "floaty") {
      const long = anims.filter((a) => a.durationMs > 500);
      if (long.length) c += ` Measured duration ${long.map((a) => `${Math.round(a.durationMs)}ms`).join(", ")} is above the suggested range.`;
    }
    if (entry.id === "stiff" && anims.some((a) => /^(linear|none)$/i.test(a.easing.trim()))) {
      c += " Measured easing is linear.";
    }
    if (entry.id === "abrupt" && anims.some((a) => a.durationMs < 100)) {
      c += ` Measured duration ${anims.filter((a) => a.durationMs < 100).map((a) => `${Math.round(a.durationMs)}ms`).join(", ")} is very short.`;
    }
    changes.push(c);
  }
  return { target: targets.join("; "), change: changes.join(" ") };
}

function currentValuesText(anims: AnimationInfo[]): string {
  if (!anims.length) return "No measured values available for this moment.";
  return anims.map(describeAnimation).join("; ");
}

function buildIssue(opts: {
  timeMs: number | null;
  selector: string | null;
  text: string;
  anims: AnimationInfo[];
  phase: Phase;
}): BriefIssue {
  const matches = detectVocabulary(opts.text);
  const { target, change } = suggestFor(matches, opts.anims);
  const phaseNote = opts.phase === "unknown" ? "" : ` (${opts.phase} the main motion)`;
  return {
    timeMs: opts.timeMs,
    selector: opts.selector,
    problem: `${opts.text.trim()}${phaseNote}`,
    currentValues: currentValuesText(opts.anims),
    target,
    suggestedChange: change,
  };
}

// ---------- main ----------

const fmtTime = (ms: number | null) => (ms == null ? "unspecified time" : `${(ms / 1000).toFixed(2)}s`);

export function buildHeuristicBrief(input: BriefInput): BriefOutput {
  const issues: BriefIssue[] = [];
  const pins = [...input.pins].sort((a, b) => a.timeMs - b.timeMs);
  const covered: string[] = [];

  for (const pin of pins) {
    const anims = animationsFor(pin.timeMs, pin.selector, input, pin);
    const cuePhase = phaseFromCue(pin.text);
    const phase = cuePhase !== "unknown" ? cuePhase : phaseFromTime(pin.timeMs, anims);
    issues.push(buildIssue({ timeMs: pin.timeMs, selector: pin.selector, text: pin.text, anims, phase }));
    covered.push(pin.text.toLowerCase());
  }

  // Narration sentences not already represented by a pin.
  for (const sentence of splitSentences(input.narration)) {
    const lower = sentence.toLowerCase();
    if (covered.some((c) => c.includes(lower) || lower.includes(c))) continue;
    const matches = detectVocabulary(sentence);
    const explicitTime = extractTimeMs(sentence);
    if (!matches.length && explicitTime == null) continue;
    const selector = sentenceSelector(sentence, input);
    const anims = animationsFor(explicitTime, selector, input);
    const cuePhase = phaseFromCue(sentence);
    const phase = cuePhase !== "unknown" ? cuePhase : phaseFromTime(explicitTime, anims);
    issues.push(buildIssue({ timeMs: explicitTime, selector, text: sentence, anims, phase }));
  }

  issues.sort((a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity));

  const goal = input.goal?.trim();
  const summary = issues.length
    ? `${issues.length} motion issue${issues.length === 1 ? "" : "s"} to fix in ${input.componentName}` +
      (goal ? `, goal: ${goal}` : "") +
      `. Built without a language model from ${pins.length} pin${pins.length === 1 ? "" : "s"} and the narration.`
    : `No specific motion issues could be extracted for ${input.componentName}; add pins or describe the problem with motion words (for example "overshoots", "too slow", "jittery").`;

  const constraints = [...FIXED_CONSTRAINTS];
  if (!input.animations.length) {
    constraints.push("No measured animation values were supplied; inspect the component code for the real values before changing anything.");
  }

  return {
    summary,
    issues,
    constraints,
    prompt: renderPrompt(input, summary, issues, constraints),
    source: "heuristic",
  };
}

function renderPrompt(input: BriefInput, summary: string, issues: BriefIssue[], constraints: string[]): string {
  const out: string[] = [];
  out.push(`# Fix motion in \`${input.componentName}\``, "");
  if (input.goal?.trim()) out.push(`Goal: ${input.goal.trim()}`, "");
  out.push(summary, "");

  if (issues.length) {
    out.push("## Issues", "");
    issues.forEach((iss, i) => {
      out.push(`### ${i + 1}. ${fmtTime(iss.timeMs)}${iss.selector ? ` on \`${iss.selector}\`` : ""}`);
      out.push(`- Problem: ${iss.problem}`);
      out.push(`- Current (measured): ${iss.currentValues}`);
      out.push(`- Wanted: ${iss.target}`);
      out.push(`- Change: ${iss.suggestedChange}`);
      const hits = findCodeHits(input.files, iss.selector, 6);
      if (hits.length) {
        out.push("- Relevant code:");
        hits.forEach((h) => out.push(`  - ${h.file}:${h.line}  \`${h.text}\``));
      }
      out.push("");
    });
  }

  if (input.animations.length) {
    out.push("## All measured animations", "");
    input.animations.forEach((a) => out.push(`- ${a.selector ?? "(no selector)"}: ${describeAnimation(a)}`));
    out.push("");
  }

  const raw = input.narration.trim();
  if (raw) {
    out.push("## Original narration (verbatim, for context)", "", raw.length > 2000 ? `${raw.slice(0, 2000)}...` : raw, "");
  }

  out.push("## Constraints", "", ...constraints.map((c) => `- ${c}`), "");
  out.push("## Deliverable", "", "Edit the component so each issue is resolved, then list the old and new value for every property you changed.");
  return out.join("\n");
}
