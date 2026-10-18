/**
 * Motion glossary: casual words -> concrete motion terms and values.
 * Pure data plus a detection helper. Ranges are starting points, not facts
 * about the user's code; callers must label them as suggestions.
 */

export interface VocabEntry {
  id: string;
  /** Regex source fragments (case-insensitive) that trigger this entry. */
  patterns: string[];
  /** What the speaker most likely means, in motion-engineering terms. */
  meaning: string;
  /** Typical diagnosis of the cause. */
  likelyCause: string;
  /** Concrete direction to move values. */
  direction: string;
  css?: string;
  gsap?: string;
  motion?: string;
  /** Suggested numeric ranges. */
  ranges?: Record<string, [number, number]>;
  /** The opposite complaint's id, if any. */
  opposite?: string;
}

export const VOCABULARY: VocabEntry[] = [
  {
    id: "floaty",
    patterns: ["floaty", "floating", "drift(?:s|y|ing)?", "weightless", "lazy"],
    meaning: "Motion lacks weight: long, low-acceleration movement with a very soft start and end.",
    likelyCause: "Duration too long and/or symmetric ease-in-out or a low-stiffness spring.",
    direction: "Shorten duration, front-load velocity (ease-out), raise spring stiffness.",
    css: "transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1); duration 200-400ms",
    gsap: "ease: 'power3.out', duration: 0.3",
    motion: "type: 'spring', stiffness: 300-500, damping: 28-40",
    ranges: { durationMs: [200, 400], stiffness: [300, 500], damping: [28, 40] },
    opposite: "snappy",
  },
  {
    id: "snappy",
    patterns: ["snappy", "snap(?:s|ped|ping)? (?:in|into|to)", "crisp", "punchy", "quick(?:ly)?"],
    meaning: "Fast, decisive movement that arrives quickly with little or no overshoot.",
    likelyCause: "Short duration with strong ease-out or a stiff, well-damped spring.",
    direction: "Duration 120-250ms, ease-out, high stiffness with damping near critical.",
    css: "cubic-bezier(0.2, 0, 0, 1); duration 120-250ms",
    gsap: "ease: 'expo.out', duration: 0.2",
    motion: "type: 'spring', stiffness: 500-900, damping: 35-50",
    ranges: { durationMs: [120, 250], stiffness: [500, 900], damping: [35, 50] },
    opposite: "sluggish",
  },
  {
    id: "jittery",
    patterns: ["jitter(?:y|s|ing)?", "jank(?:y)?", "stutter(?:s|ing|y)?", "shak(?:y|es|ing)", "choppy", "glitch(?:y|es)?", "flicker(?:s|ing)?", "twitch(?:y|es)?"],
    meaning: "Frame-to-frame instability: values change in uneven steps or fight each other.",
    likelyCause: "Animating layout properties (top/left/width/height), competing tweens on one property, rounding to whole pixels, missing will-change/GPU compositing, or setState-driven animation.",
    direction: "Animate transform/opacity only, kill or overwrite conflicting tweens, avoid layout thrash, avoid sub-pixel snapping.",
    css: "animate transform and opacity; will-change: transform (only during the animation)",
    gsap: "overwrite: 'auto'; use x/y instead of left/top; force3D: true",
    motion: "animate x/y/scale instead of left/top/width; use layout animations sparingly",
  },
  {
    id: "overshoot",
    patterns: ["overshoot(?:s|ing)?", "over-?shoot", "goes? (?:too )?(?:far|past)", "snaps? back", "bounces? back", "rubber[- ]?band(?:s|ing)?", "springs? back"],
    meaning: "The value passes its target and returns; may be wanted (small) or excessive.",
    likelyCause: "Under-damped spring, back/elastic ease, or a keyframe that exceeds the end value.",
    direction: "Raise damping (or damping ratio toward 1) to reduce or remove overshoot; if some life is wanted, cap overshoot at 2-5% of travel.",
    css: "replace cubic-bezier(.34,1.56,.64,1) with cubic-bezier(0.22, 1, 0.36, 1)",
    gsap: "replace back.out(1.7)/elastic with back.out(0.6) or power3.out",
    motion: "increase damping; damping ratio 0.8-1.0 for a soft settle",
    ranges: { overshootPercent: [0, 5], dampingRatio: [0.8, 1] },
  },
  {
    id: "settle",
    patterns: ["settl(?:e|es|ed|ing)", "come(?:s)? to rest", "ease(?:s)? (?:in)?to (?:place|rest)", "land(?:s|ing)? (?:softly|gently)", "softly"],
    meaning: "A soft, damped arrival: velocity decays smoothly to zero at the target.",
    likelyCause: "Needs a long deceleration tail or a critically/slightly under-damped spring.",
    direction: "Use ease-out with a long tail, or a spring with damping ratio ~0.8-1.0 and moderate stiffness.",
    css: "cubic-bezier(0.16, 1, 0.3, 1); duration 350-600ms",
    gsap: "ease: 'power4.out' or 'expo.out', duration: 0.5",
    motion: "type: 'spring', stiffness: 170-260, damping: 22-30 (or bounce: 0-0.15)",
    ranges: { durationMs: [350, 600], stiffness: [170, 260], damping: [22, 30] },
  },
  {
    id: "sluggish",
    patterns: ["sluggish", "slow(?:ly)?", "laggy", "lag(?:s|ging)?", "takes (?:too )?long", "heavy", "drag(?:s|ging)?"],
    meaning: "Takes too long to start or finish; feels unresponsive.",
    likelyCause: "Duration above ~500ms for a UI transition, a delay before the start, or ease-in at the beginning.",
    direction: "Cut duration and delay; switch to ease-out so movement starts immediately.",
    css: "duration 150-300ms; delay 0; ease-out",
    gsap: "duration: 0.25, delay: 0, ease: 'power2.out'",
    motion: "stiffness: 400-700, damping: 30-45",
    ranges: { durationMs: [150, 300], delayMs: [0, 50] },
    opposite: "snappy",
  },
  {
    id: "abrupt",
    patterns: ["abrupt(?:ly)?", "sudden(?:ly)?", "harsh(?:ly)?", "jump(?:s|y|ing)?", "pops?(?: in| up)?", "instant(?:ly)?", "teleport(?:s|ing)?", "cuts? (?:in|off)", "no (?:easing|transition|animation)"],
    meaning: "Change happens with no perceptible acceleration or in too few frames.",
    likelyCause: "Linear/step easing, near-zero duration, display toggled instead of animated, or element mounted with no enter transition.",
    direction: "Add a 150-300ms eased transition on opacity/transform; avoid animating display.",
    css: "transition: opacity 200ms ease-out, transform 200ms ease-out",
    gsap: "gsap.from(el, { opacity: 0, y: 8, duration: 0.25, ease: 'power2.out' })",
    motion: "initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}",
    ranges: { durationMs: [150, 300] },
  },
  {
    id: "stiff",
    patterns: ["stiff", "robotic", "mechanical", "rigid", "linear", "lifeless", "flat"],
    meaning: "Motion has constant velocity or no acceleration curve; lacks organic feel.",
    likelyCause: "ease: linear, or a spring with too high stiffness and damping.",
    direction: "Use an ease-out/ease-in-out curve or a spring with a little bounce; add subtle secondary motion only if asked.",
    css: "replace linear with cubic-bezier(0.25, 0.1, 0.25, 1) or cubic-bezier(0.22, 1, 0.36, 1)",
    gsap: "replace 'none'/'linear' with 'power2.out'",
    motion: "type: 'spring', stiffness: 200-350, damping: 18-26",
    ranges: { stiffness: [200, 350], damping: [18, 26] },
  },
  {
    id: "bouncy",
    patterns: ["bouncy", "bounc(?:e|es|ing)", "springy", "playful", "elastic", "wobbl(?:e|y|es|ing)", "jelly"],
    meaning: "Visible oscillation around the target after arrival.",
    likelyCause: "Low damping ratio (<0.6) spring, elastic/bounce ease.",
    direction: "To add: lower damping ratio to 0.4-0.6. To reduce: raise damping ratio to 0.8+.",
    css: "linear() spring approximation, or cubic-bezier(0.34, 1.56, 0.64, 1) for one soft overshoot",
    gsap: "ease: 'back.out(1.4)' or 'elastic.out(1, 0.5)'",
    motion: "type: 'spring', bounce: 0.25-0.4 (or stiffness 250, damping 14-20)",
    ranges: { dampingRatio: [0.4, 0.6], bounce: [0.25, 0.4] },
  },
  {
    id: "ease-out",
    patterns: ["ease[- ]?out", "decelerat(?:e|es|ion|ing)", "slows? (?:down )?(?:at|towards?|as)"],
    meaning: "Fast start, slow end. Best for elements entering or responding to input.",
    likelyCause: "n/a",
    direction: "Use for enters and user-initiated movement.",
    css: "cubic-bezier(0, 0, 0.2, 1) or cubic-bezier(0.22, 1, 0.36, 1)",
    gsap: "'power2.out' to 'power4.out'",
    motion: "ease: 'easeOut' or [0.22, 1, 0.36, 1]",
  },
  {
    id: "ease-in",
    patterns: ["ease[- ]?in(?!-?out)", "accelerat(?:e|es|ion|ing)", "speeds? up", "slow start"],
    meaning: "Slow start, fast end. Best for elements leaving the screen.",
    likelyCause: "n/a",
    direction: "Use for exits; avoid for entrances (feels sluggish).",
    css: "cubic-bezier(0.4, 0, 1, 1)",
    gsap: "'power2.in'",
    motion: "ease: 'easeIn'",
  },
  {
    id: "ease-in-out",
    patterns: ["ease[- ]?in[- ]?out", "smooth(?:ly)?"],
    meaning: "Symmetric acceleration and deceleration, good for on-screen repositioning.",
    likelyCause: "n/a",
    direction: "Use for movement between two on-screen positions.",
    css: "cubic-bezier(0.4, 0, 0.2, 1)",
    gsap: "'power2.inOut'",
    motion: "ease: 'easeInOut'",
  },
  {
    id: "stagger",
    patterns: ["stagger(?:s|ed|ing)?", "one (?:after|by) (?:the )?(?:other|one)", "cascad(?:e|es|ing)", "sequen(?:tial|ce)ly", "all at once", "same time", "simultaneous(?:ly)?", "wave"],
    meaning: "Per-item delay offsets so children enter in a sequence rather than together.",
    likelyCause: "Children share one start time (no stagger) or the stagger is too large and the last item arrives late.",
    direction: "Use 30-80ms between items; cap total stagger at ~400ms.",
    css: "transition-delay: calc(var(--i) * 50ms)",
    gsap: "stagger: 0.05 (or { each: 0.05, from: 'start' })",
    motion: "transition={{ delayChildren: stagger(0.05) }}",
    ranges: { staggerMs: [30, 80], totalStaggerMs: [0, 400] },
  },
  {
    id: "spring",
    patterns: ["spring(?:s)?\\b", "stiffness", "damping", "mass\\b", "tension", "friction"],
    meaning: "Physics-based motion defined by stiffness, damping, mass instead of duration and easing.",
    likelyCause: "n/a",
    direction: "Stiffness controls speed, damping controls overshoot; damping ratio = damping / (2 * sqrt(stiffness * mass)).",
    motion: "type: 'spring', stiffness: 100-1000, damping: 10-50, mass: 1",
    ranges: { stiffness: [100, 1000], damping: [10, 50], mass: [0.5, 2] },
  },
  {
    id: "delay",
    patterns: ["delay(?:ed|s)?", "waits? (?:a bit|too long)", "hesitat(?:e|es|ion)", "late(?:r)? start", "starts? late"],
    meaning: "Gap between trigger and visible movement.",
    likelyCause: "Non-zero animation-delay/delay, or a mount that waits on data.",
    direction: "Keep trigger-to-motion latency under ~100ms for responsive UI.",
    css: "animation-delay / transition-delay: 0-80ms",
    gsap: "delay: 0",
    ranges: { delayMs: [0, 80] },
  },
  {
    id: "fade",
    patterns: ["fad(?:e|es|ing)", "opacity", "transparen(?:t|cy)"],
    meaning: "Opacity transition, usually combined with a small transform.",
    likelyCause: "n/a",
    direction: "Fade-in 150-250ms ease-out; fade-out 100-200ms ease-in.",
    css: "transition: opacity 200ms ease-out",
    gsap: "opacity: 0 -> 1, duration: 0.2",
    ranges: { durationMs: [100, 250] },
  },
];

export interface VocabMatch {
  entry: VocabEntry;
  /** Matched phrases as they appeared in the text. */
  hits: string[];
}

const compiled = VOCABULARY.map((entry) => ({
  entry,
  re: new RegExp(`\\b(?:${entry.patterns.join("|")})`, "gi"),
}));

/** Find glossary entries mentioned in free text. Deterministic, order = glossary order. */
export function detectVocabulary(text: string): VocabMatch[] {
  const out: VocabMatch[] = [];
  for (const { entry, re } of compiled) {
    re.lastIndex = 0;
    const hits = new Set<string>();
    for (const m of text.matchAll(re)) hits.add(m[0].toLowerCase());
    if (hits.size) out.push({ entry, hits: [...hits] });
  }
  // "ease-in" must not also fire on "ease-in-out" (handled by lookahead);
  // "spring back" overlaps overshoot and spring, which is acceptable.
  return out;
}

export function getEntry(id: string): VocabEntry | undefined {
  return VOCABULARY.find((e) => e.id === id);
}

/** Compact glossary text for use inside the model prompt. */
export function glossaryForPrompt(): string {
  return VOCABULARY.map(
    (e) =>
      `- ${e.id}: ${e.meaning} Direction: ${e.direction}` +
      (e.css ? ` CSS: ${e.css}.` : "") +
      (e.gsap ? ` GSAP: ${e.gsap}.` : "") +
      (e.motion ? ` Motion: ${e.motion}.` : ""),
  ).join("\n");
}
