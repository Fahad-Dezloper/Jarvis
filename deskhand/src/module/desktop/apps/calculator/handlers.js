import useWindowsStore from "@store/window";
import "../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import { compute } from "./calcCore";
import useCalcStore from "./calcStore";

let last = "";

if (typeof window !== "undefined") {
  registerHandlers("calculator", {
    compute: async (args) => {
      try {
        const raw = String(args?.expression ?? "").trim();
        if (!raw) return { ok: false, message: "No expression was given." };
        const r = compute(raw);
        if (!r.ok) return { ok: false, message: `Could not calculate "${raw}": ${r.error}` };
        useWindowsStore.getState().openWindow("calculator");
        useCalcStore.getState().show(r.expr, r.text);
        last = `${r.expr} = ${r.text}`;
        return { ok: true, message: `${r.expr} = ${r.text}`, data: `${r.expr} = ${r.text}` };
      } catch (err) {
        return { ok: false, message: `Calculator error: ${err?.message || err}` };
      }
    },
  });
  registerSummary("calculator", () =>
    last ? `Calculator last result: ${last}.` : "Calculator has not been used yet.",
  );
}
