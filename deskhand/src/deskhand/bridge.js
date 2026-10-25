// Imperative handles that apps register so the engine can drive them.
// An app calls registerHandlers("music", {...}) in an effect and runs the
// returned unregister function on unmount. Handler names must match
// src/deskhand/capabilities.js. Handlers never throw: they return
// { ok:boolean, message:string }.

const registry = new Map();

/**
 * @param {string} app  Capability group, e.g. "music", "terminal", "notes", "browser", "finder", "settings".
 * @param {Record<string,(args:Record<string,unknown>)=>Promise<{ok:boolean,message:string}>|{ok:boolean,message:string}>} handlers
 * @returns {() => void} unregister
 */
export function registerHandlers(app, handlers) {
  registry.set(app, handlers);
  return () => {
    if (registry.get(app) === handlers) registry.delete(app);
  };
}

export function getHandlers(app) {
  return registry.get(app) ?? null;
}

export function listRegisteredApps() {
  return [...registry.keys()];
}

/** Optional state each app can expose for the model's context. */
const summaries = new Map();

/** @param {string} app @param {() => string} getSummary */
export function registerSummary(app, getSummary) {
  summaries.set(app, getSummary);
  return () => {
    if (summaries.get(app) === getSummary) summaries.delete(app);
  };
}

export function collectSummaries() {
  const out = {};
  for (const [app, fn] of summaries) {
    try {
      out[app] = fn();
    } catch {
      out[app] = "";
    }
  }
  return out;
}
