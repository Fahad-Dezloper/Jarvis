import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PlayerHarness } from "./PlayerHarness";

export const metadata = { title: "Player dev harness" };

export default function DevPlayerPage() {
  // GSAP comes from the installed package so the harness works offline.
  const gsapSource = readFileSync(
    join(process.cwd(), "node_modules", "gsap", "dist", "gsap.min.js"),
    "utf8",
  );
  return <PlayerHarness gsapSource={gsapSource} />;
}
