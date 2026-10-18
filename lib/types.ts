// Shared contracts. Every phase builds against these; change them deliberately.

/** A single animation discovered inside the preview iframe. */
export interface AnimationInfo {
  id: string;
  kind: "css" | "waapi" | "gsap" | "smil";
  /** Short human label, e.g. "transform on .logo". */
  label: string;
  /** CSS selector that targets the animated element, when known. */
  selector: string | null;
  durationMs: number;
  delayMs: number;
  easing: string;
  iterations: number;
  /** Animated properties, e.g. ["transform", "opacity"]. */
  properties: string[];
}

/** Runtime inside the iframe -> host. */
export type RuntimeEvent =
  | { type: "mb:ready" }
  | { type: "mb:animations"; animations: AnimationInfo[]; totalMs: number }
  | { type: "mb:time"; timeMs: number; playing: boolean }
  | { type: "mb:element-picked"; selector: string; tag: string; rect: DOMRectLike }
  | { type: "mb:error"; message: string };

/** Host -> runtime inside the iframe. */
export type RuntimeCommand =
  | { type: "mb:play" }
  | { type: "mb:pause" }
  | { type: "mb:seek"; timeMs: number }
  | { type: "mb:step"; deltaMs: number }
  | { type: "mb:rate"; rate: number }
  | { type: "mb:restart" }
  | { type: "mb:scan" }
  | { type: "mb:pick-mode"; enabled: boolean };

export interface DOMRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A spoken/typed note anchored to a moment and (optionally) an element. */
export interface Pin {
  id: string;
  timeMs: number;
  selector: string | null;
  text: string;
  /** Animation values measured at this moment, if available. */
  measured?: AnimationInfo[];
}

/** Everything the prompt builder needs. */
export interface BriefInput {
  componentName: string;
  files: Record<string, string>;
  animations: AnimationInfo[];
  /** Free-form continuous narration, as dictated. */
  narration: string;
  /** Playhead moments logged while narrating. */
  pins: Pin[];
  goal?: string;
}

export interface BriefIssue {
  timeMs: number | null;
  selector: string | null;
  problem: string;
  currentValues: string;
  target: string;
  suggestedChange: string;
}

export interface BriefOutput {
  summary: string;
  issues: BriefIssue[];
  constraints: string[];
  /** The final prompt to hand to an AI coding agent. */
  prompt: string;
  /** "model" when an LLM produced it, "heuristic" for the no-key fallback. */
  source: "model" | "heuristic";
}
