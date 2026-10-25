// Placeholder so the command bar can import the engine before it exists.
// The engine owner replaces this file.
/** @type {import("../contract").RunCommand} */
export async function runCommand(text, opts = {}) {
  const reply = "The action engine is not connected yet.";
  opts.onEvent?.({ type: "done", reply, ok: false });
  return { reply, source: "rules", ok: false };
}
