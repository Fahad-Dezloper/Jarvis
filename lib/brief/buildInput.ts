import { LIMITS } from "./schema";
import type { AnimationInfo, BriefInput, Pin } from "@/lib/types";

/** The API schema only takes finite numbers; an endless loop is sent as a very large count. */
export const ENDLESS_ITERATIONS = 999_999;

function cleanAnimation(a: AnimationInfo): AnimationInfo {
  return {
    ...a,
    id: a.id.slice(0, 200),
    label: a.label.slice(0, 500),
    selector: a.selector ? a.selector.slice(0, 500) : null,
    easing: a.easing.slice(0, 300),
    durationMs: Number.isFinite(a.durationMs) ? a.durationMs : 0,
    delayMs: Number.isFinite(a.delayMs) ? a.delayMs : 0,
    iterations: Number.isFinite(a.iterations) ? a.iterations : ENDLESS_ITERATIONS,
    properties: a.properties.slice(0, 50).map((p) => p.slice(0, 100)),
  };
}

export interface BuildInputArgs {
  componentName: string;
  /** path -> source for the user-visible files. */
  files: Record<string, string>;
  animations: AnimationInfo[];
  narration: string;
  pins: Pin[];
  goal?: string;
}

/** Shape live workbench state into a BriefInput that satisfies the API limits. */
export function buildBriefInput(args: BuildInputArgs): BriefInput {
  const files: Record<string, string> = {};
  let budget = LIMITS.filesTotalChars;
  for (const [path, code] of Object.entries(args.files)) {
    if (budget <= 0) break;
    const slice = code.slice(0, budget);
    files[path.slice(0, 300)] = slice;
    budget -= slice.length;
  }
  const pins = [...args.pins]
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, LIMITS.pins)
    .map((p) => ({
      id: p.id.slice(0, 200),
      timeMs: Math.max(0, Number.isFinite(p.timeMs) ? p.timeMs : 0),
      selector: p.selector ? p.selector.slice(0, 500) : null,
      text: p.text.slice(0, 2_000),
      ...(p.measured ? { measured: p.measured.slice(0, 50).map(cleanAnimation) } : {}),
    }));
  return {
    componentName: (args.componentName.trim() || "Component").slice(0, 200),
    files,
    animations: args.animations.slice(0, 200).map(cleanAnimation),
    narration: args.narration.slice(0, LIMITS.narrationChars),
    pins,
    ...(args.goal ? { goal: args.goal.slice(0, 2_000) } : {}),
  };
}
