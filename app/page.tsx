import { Suspense } from "react";
import Workbench from "@/components/workbench/Workbench";

function WorkbenchFallback() {
  return (
    <div className="grid h-dvh place-items-center text-sm text-zinc-500">
      <span className="animate-pulse">Loading workbench...</span>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      {/* Sandpack reads the clock while rendering, so it streams in behind Suspense. */}
      <Suspense fallback={<WorkbenchFallback />}>
        <Workbench />
      </Suspense>
    </main>
  );
}
