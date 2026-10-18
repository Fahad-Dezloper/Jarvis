import { SendActions } from "@/components/send/SendActions";
import type { BriefOutput } from "@/lib/types";

export const metadata = { title: "Send dev harness" };

const short: BriefOutput = {
  summary: "The logo overshoots too hard and the list items appear all at once.",
  issues: [
    {
      timeMs: 700,
      selector: ".logo",
      problem: "Logo overshoots and snaps back",
      currentValues: "900ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      target: "Soft settle, no visible snap",
      suggestedChange: "Use cubic-bezier(0.22, 1, 0.36, 1) over 700ms.",
    },
    {
      timeMs: 1300,
      selector: ".item",
      problem: "Items appear together",
      currentValues: "opacity 600ms linear, delay 1000ms",
      target: "Staggered reveal",
      suggestedChange: "Stagger by 80ms with ease-out.",
    },
  ],
  constraints: ["Keep total duration under 2s", "Respect prefers-reduced-motion"],
  prompt:
    "Edit Hero.css and Hero.tsx.\n\n1. .logo: replace cubic-bezier(0.34, 1.56, 0.64, 1) with cubic-bezier(0.22, 1, 0.36, 1) & 700ms.\n2. .item: stagger 80ms, ease-out.\n\nKeep it under 2s; honour 'prefers-reduced-motion'.",
  source: "heuristic",
};

const long: BriefOutput = {
  ...short,
  prompt: short.prompt + "\n\n" + "Additional context line with detail & symbols + more. ".repeat(160),
};

export default function DevSendPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 bg-zinc-950 p-6 text-zinc-100">
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Short prompt (fits)</h1>
        <SendActions brief={short} componentName="Hero" />
      </section>
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Long prompt (fallback)</h1>
        <SendActions brief={long} componentName="Hero" />
      </section>
    </main>
  );
}
