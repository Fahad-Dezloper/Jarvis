"use client";

import { useState } from "react";
import type { Pin } from "@/lib/types";
import { VideoAnnotator } from "@/components/recorder/VideoAnnotator";

export function RecorderHarness() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [narration, setNarration] = useState("");
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-lg font-semibold">Recorder dev harness</h1>
      <VideoAnnotator
        pins={pins}
        onPinsChange={setPins}
        onNarrationAppend={(t) => setNarration((n) => (n ? n + "\n" : "") + t)}
      />
      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Narration appended</h2>
        <pre data-testid="narration" className="whitespace-pre-wrap rounded bg-zinc-900 p-2 text-xs text-zinc-300">{narration || "(none)"}</pre>
      </section>
      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Pins JSON</h2>
        <pre data-testid="pins" className="overflow-x-auto rounded bg-zinc-900 p-2 text-xs text-zinc-300">{JSON.stringify(pins, null, 2)}</pre>
      </section>
    </main>
  );
}
