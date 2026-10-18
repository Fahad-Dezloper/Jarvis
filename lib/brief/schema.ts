import { z } from "zod";
import type { BriefInput, BriefOutput } from "@/lib/types";

export const LIMITS = {
  narrationChars: 12_000,
  filesTotalChars: 60_000,
  pins: 50,
} as const;

const animationInfo = z.object({
  id: z.string().max(200),
  kind: z.enum(["css", "waapi", "gsap", "smil"]),
  label: z.string().max(500),
  selector: z.string().max(500).nullable(),
  durationMs: z.number().finite(),
  delayMs: z.number().finite(),
  easing: z.string().max(300),
  iterations: z.number(),
  properties: z.array(z.string().max(100)).max(50),
});

const pin = z.object({
  id: z.string().max(200),
  timeMs: z.number().finite().min(0),
  selector: z.string().max(500).nullable(),
  text: z.string().max(2_000),
  measured: z.array(animationInfo).max(50).optional(),
});

export const briefInputSchema = z.object({
  componentName: z.string().min(1).max(200),
  files: z
    .record(z.string().max(300), z.string())
    .refine(
      (f) => Object.values(f).reduce((n, s) => n + s.length, 0) <= LIMITS.filesTotalChars,
      { message: `files exceed ${LIMITS.filesTotalChars} characters in total` },
    ),
  animations: z.array(animationInfo).max(200),
  narration: z.string().max(LIMITS.narrationChars),
  pins: z.array(pin).max(LIMITS.pins),
  goal: z.string().max(2_000).optional(),
}) satisfies z.ZodType<BriefInput>;

export const briefIssueSchema = z.object({
  timeMs: z.number().nullable(),
  selector: z.string().nullable(),
  problem: z.string(),
  currentValues: z.string(),
  target: z.string(),
  suggestedChange: z.string(),
});

/** What the model is asked to produce (source is stamped by the server). */
export const modelBriefSchema = z.object({
  summary: z.string(),
  issues: z.array(briefIssueSchema),
  constraints: z.array(z.string()),
  prompt: z.string(),
});

export const briefOutputSchema = modelBriefSchema.extend({
  source: z.enum(["model", "heuristic"]),
}) satisfies z.ZodType<BriefOutput>;

export type ModelBrief = z.infer<typeof modelBriefSchema>;
