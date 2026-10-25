// Dev-only stand-in for the engine. Used only when window.__DK_MOCK__ is set.
// It emits plausible EngineEvents and performs window changes through the store.
import useWindowsStore from "@store/window";

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    });
  });

function planFor(text) {
  const t = text.toLowerCase();
  const actions = [];
  if (/claude code|terminal/.test(t) && /open|launch|start/.test(t))
    actions.push({ type: "open", window: "terminal" });
  if (/npm run dev/.test(t))
    actions.push({
      type: "invoke",
      app: "terminal",
      name: "run_command",
      args: { command: "npm run dev" },
    });
  if (/\b(close|quit)\b/.test(t))
    actions.push({
      type: "close",
      window: /close (the )?(spotify|music)/.test(t) ? "music" : "terminal",
    });
  if (/spotify|music/.test(t) && /open|launch/.test(t))
    actions.push({ type: "open", window: "music" });
  if (/hinv/.test(t))
    actions.push({ type: "invoke", app: "music", name: "play", args: { query: "HiNV Music" } });
  if (/dark mode/.test(t))
    actions.push({ type: "invoke", app: "settings", name: "set_theme", args: { theme: "dark" } });
  if (/resize|tile|look good/.test(t)) actions.push({ type: "tile", layout: "grid" });
  if (!actions.length) actions.push({ type: "say", text: "I did not catch a command in that." });
  return actions;
}

function rectFor(action) {
  const id = action.window || (action.app === "music" ? "music" : "terminal");
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  const r = el && el.getBoundingClientRect();
  if (r && r.width > 0) {
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  return { x: window.innerWidth / 2 - 24, y: window.innerHeight - 80, width: 48, height: 48 };
}

function perform(action) {
  const s = useWindowsStore.getState();
  if (action.type === "open") s.openWindow(action.window);
  else if (action.type === "close") s.closeWindow(action.window);
  else if (action.type === "invoke" && action.app === "music" && action.name === "play") {
    s.openWindow("music");
    s.setMusicState({
      isPlaying: true,
      playlist: "HiNV Music",
      activeTrack: { ...s.music.activeTrack, id: 1, title: "Mock track", url: "x" },
    });
  } else if (action.type === "invoke" && action.name === "set_theme") {
    s.updateSystemSetting("darkMode", action.args.theme === "dark");
  }
}

export async function mockRunCommand(text, opts = {}) {
  const { onEvent, signal } = opts;
  if (/fail/i.test(text)) throw new Error("Mock engine failure for testing.");
  const actions = planFor(text);
  const reply = actions[0].type === "say" ? actions[0].text : "On it.";
  onEvent?.({ type: "plan", actions, reply, source: /offline/i.test(text) ? "rules" : "model" });
  await sleep(250, signal);
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    onEvent?.({ type: "step", index: i, action, status: "start", rect: rectFor(action) });
    await sleep(900, signal);
    perform(action);
    await sleep(200, signal);
    onEvent?.({ type: "step", index: i, action, status: "ok" });
  }
  const done = actions[0].type === "say" ? reply : "Done.";
  onEvent?.({ type: "done", reply: done, ok: true });
  return { reply: done, source: /offline/i.test(text) ? "rules" : "model", ok: true };
}
