// Capabilities the engine itself implements (no app handler involved). They are
// merged with the shared catalog (../capabilities.js) for validation and for the
// planner prompt, and the executor serves them directly.
import { CAPABILITIES, WINDOWLESS_GROUPS } from "../capabilities.js";

export const ENGINE_CAPABILITIES = {
  ui: [
    {
      name: "snapshot",
      description:
        "Read-only. Return the current clickable elements (id, role, label, value) of one open window so you can click or type by element id. Use it before generic click/type in an app you have no capability for.",
      params: {
        type: "object",
        properties: { window: { type: "string", description: "Window key, e.g. finder" } },
        required: ["window"],
      },
    },
  ],
};

/** Groups served by the engine itself; they never need a window or a registered handler. */
export const ENGINE_GROUPS = Object.keys(ENGINE_CAPABILITIES);

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Look up a capability in the shared catalog first, then the engine's own. Never throws. */
export function findCapability(app, name) {
  if (typeof app !== "string" || typeof name !== "string") return null;
  for (const catalog of [CAPABILITIES, ENGINE_CAPABILITIES]) {
    if (!own(catalog, app)) continue;
    const hit = catalog[app].find((c) => c.name === name);
    if (hit) return hit;
  }
  return null;
}

/** Every catalog group (shared plus engine) as [app, capabilities[]] pairs. */
export function allCapabilityGroups() {
  return [...Object.entries(CAPABILITIES), ...Object.entries(ENGINE_CAPABILITIES)];
}

/** True when the group works without an open window. */
export const isWindowless = (app) => WINDOWLESS_GROUPS.includes(app) || ENGINE_GROUPS.includes(app);
