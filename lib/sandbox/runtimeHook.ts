/**
 * Hook point for the playback runtime (Phase 2).
 *
 * Phase 2 replaces RUNTIME_SOURCE with the bundled runtime code. While it is
 * an empty string the sandbox behaves exactly as if no runtime existed: the
 * file is not added and the entry snippet is empty.
 */

/** Path of the runtime file inside the sandbox file map. */
export const RUNTIME_FILE_PATH = "/mb-runtime.js";

/** Phase 2 replaces this with the runtime source. */
export const RUNTIME_SOURCE = "";

/** True once Phase 2 has provided a runtime. */
export function hasRuntime(): boolean {
  return RUNTIME_SOURCE.trim().length > 0;
}

/**
 * Snippet to put at the very top of an entry file so the runtime is
 * evaluated before any user code. Empty when there is no runtime.
 */
export function runtimeEntrySnippet(): string {
  return hasRuntime() ? `import "${RUNTIME_FILE_PATH}";\n` : "";
}

/** File-map slot for the runtime. Empty object when there is no runtime. */
export function runtimeFiles(): Record<string, { code: string; hidden: boolean }> {
  return hasRuntime()
    ? { [RUNTIME_FILE_PATH]: { code: RUNTIME_SOURCE, hidden: true } }
    : {};
}
