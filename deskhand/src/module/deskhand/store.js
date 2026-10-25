import { create } from "zustand";
import { runCommand } from "@deskhand/engine";
import { trimHistory } from "./history";
import { initialProgress, tickMissions } from "./missionsLogic";

// Engine events fan out to non-React listeners (virtual cursor, missions).
const listeners = new Set();
export function onDeskhandEvent(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function broadcast(event) {
  for (const cb of listeners) {
    try {
      cb(event);
    } catch (err) {
      console.error("deskhand listener failed", err);
    }
  }
}

let controller = null;

async function pickEngine() {
  if (typeof window !== "undefined" && window.__DK_MOCK__) {
    const mod = await import("./mockEngine");
    return mod.mockRunCommand;
  }
  return runCommand;
}

const useDeskhandStore = create((set, get) => ({
  status: "idle", // idle | running
  command: "",
  plan: null,
  steps: {}, // index -> { status, message }
  reply: "",
  source: null,
  ok: true,
  error: "",
  cancelled: false,
  history: [],
  collapsed: false,
  logOpen: true,
  hintDismissed: false,
  missions: initialProgress(),

  setCollapsed: (collapsed) => set({ collapsed }),
  setLogOpen: (logOpen) => set({ logOpen }),
  dismissHint: () => set({ hintDismissed: true }),

  tickMissions: (input) =>
    set((state) => {
      const next = tickMissions(state.missions, input);
      return next === state.missions ? state : { missions: next };
    }),

  applyEvent: (event) => {
    if (event.type === "plan") {
      set({
        plan: {
          actions: event.actions || [],
          reply: event.reply,
          source: event.source,
          note: event.note,
        },
        reply: event.reply || "",
        source: event.source || null,
        steps: {},
      });
    } else if (event.type === "step") {
      set((state) => ({
        steps: {
          ...state.steps,
          [event.index]: { status: event.status, message: event.message },
        },
      }));
    } else if (event.type === "done") {
      set({ reply: event.reply || get().reply, ok: event.ok !== false });
    }
    get().tickMissions({ event });
    broadcast(event);
  },

  cancel: () => {
    if (controller) controller.abort();
  },

  submit: async (rawText) => {
    const text = String(rawText || "").trim();
    if (!text || get().status === "running") return null;

    controller = new AbortController();
    const signal = controller.signal;
    set({
      status: "running",
      command: text,
      plan: null,
      steps: {},
      reply: "",
      source: null,
      ok: true,
      error: "",
      cancelled: false,
      collapsed: false,
      logOpen: true,
      hintDismissed: true,
    });

    try {
      const run = await pickEngine();
      const result = await run(text, {
        history: get().history,
        signal,
        onEvent: (e) => get().applyEvent(e),
      });
      if (signal.aborted) {
        set({ status: "idle", cancelled: true, reply: "Stopped.", ok: false });
        return null;
      }
      const reply = (result && result.reply) || get().reply || "Done.";
      set((state) => ({
        status: "idle",
        reply,
        source: (result && result.source) || state.source,
        ok: result ? result.ok !== false : true,
        history: trimHistory(state.history, { command: text, reply }),
      }));
      return result;
    } catch (err) {
      const aborted = signal.aborted || (err && err.name === "AbortError");
      set(
        aborted
          ? { status: "idle", cancelled: true, reply: "Stopped.", ok: false }
          : {
              status: "idle",
              ok: false,
              error: (err && err.message) || "Something went wrong running that command.",
            },
      );
      return null;
    } finally {
      controller = null;
    }
  },
}));

export default useDeskhandStore;
