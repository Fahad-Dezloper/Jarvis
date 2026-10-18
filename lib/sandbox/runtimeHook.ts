import { RUNTIME_SOURCE } from "@/lib/runtime/runtime.source";

export { RUNTIME_SOURCE };

/**
 * Hook point for the playback runtime (Phase 2).
 *
 * The runtime source lives in lib/runtime/runtime.source.ts and is added to the
 * sandbox as a hidden file. If it were ever empty the sandbox would behave as
 * if no runtime existed.
 */

/** Path of the runtime file inside the sandbox file map. */
export const RUNTIME_FILE_PATH = "/mb-runtime.js";

/** True when a runtime source is available. */
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
