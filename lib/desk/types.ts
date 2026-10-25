// Shared contract for the Deskhand web demo. Shell, apps, the action engine and
// the docs all build against these types; change them deliberately.

export type AppId = "terminal" | "notes" | "browser" | "music" | "files" | "settings";

export interface WindowState {
  id: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Higher is in front. */
  z: number;
  minimized: boolean;
  maximized: boolean;
}

/** One thing on screen that a command can target. */
export interface UiElement {
  /** Stable within a window, e.g. "play-hinv", "link-artifact-poker", "input". */
  id: string;
  role: "button" | "link" | "input" | "track" | "playlist" | "file" | "tab" | "text";
  label: string;
  value?: string;
}

/** What an app exposes to the action engine about its current state. */
export interface AppSnapshot {
  appId: AppId;
  windowId: string;
  /** One or two sentences a model can read, e.g. "Music: playing 'Night Drive' from HiNV Music." */
  summary: string;
  elements: UiElement[];
  state: Record<string, unknown>;
}

/** A named thing an app can do, described for the model. */
export interface AppCapability {
  name: string;
  description: string;
  /** Plain JSON Schema for the arguments. */
  params: Record<string, unknown>;
}

export interface ActionResult {
  ok: boolean;
  /** Short human sentence for the action log. */
  message: string;
}

/** Implemented by each app component and registered with the shell. */
export interface AppController {
  capabilities: AppCapability[];
  snapshot(): AppSnapshot;
  /** Runs one capability. Must never throw; return ok:false instead. */
  invoke(name: string, args: Record<string, unknown>): Promise<ActionResult> | ActionResult;
}

export interface DesktopSnapshot {
  screen: { width: number; height: number };
  /** Front-to-back order is by `z`. */
  windows: WindowState[];
  apps: AppSnapshot[];
  clipboard: string;
  /** ISO time, so "play something for tonight" has context. */
  now: string;
}

/** Window-level and app-level actions the engine can emit. */
export type Action =
  | { type: "open_app"; app: AppId }
  | { type: "close_window"; window: string }
  | { type: "focus_window"; window: string }
  | { type: "minimize_window"; window: string }
  | { type: "maximize_window"; window: string }
  | { type: "restore_window"; window: string }
  | { type: "move_window"; window: string; x: number; y: number }
  | { type: "resize_window"; window: string; width: number; height: number }
  | { type: "tile_windows"; layout: "grid" | "columns" | "rows" | "cascade" }
  /** Click an element by its UiElement id. */
  | { type: "click"; window: string; element: string }
  /** Type text into an input element (or the window's main input). */
  | { type: "type"; window: string; element?: string; text: string; submit?: boolean }
  /** Anything an app declared in its capabilities, e.g. music.play, terminal.run. */
  | { type: "invoke"; window: string; name: string; args: Record<string, unknown> }
  | { type: "set_clipboard"; text: string }
  | { type: "say"; text: string };

/** `window` accepts a window id or an app id (meaning its front-most window). */
export interface ActRequest {
  /** What the user said, as typed by their dictation tool. */
  command: string;
  snapshot: DesktopSnapshot;
  /** Prior turns, newest last, for follow-ups like "now close it". */
  history?: { command: string; reply: string }[];
}

export interface ActResponse {
  actions: Action[];
  /** One short spoken-style reply shown in the command bar. */
  reply: string;
  /** "model" when an LLM planned it, "rules" for the offline parser. */
  source: "model" | "rules";
  note?: string;
}

/** Services the shell gives every app (via React context). */
export interface DeskApi {
  windowId: string;
  /** Register this window's controller so the engine can see and drive it. */
  register(controller: AppController): () => void;
  openApp(app: AppId, opts?: { focus?: boolean }): string;
  closeWindow(window: string): void;
  getClipboard(): string;
  setClipboard(text: string): void;
  /** Append a line to the visible action log. */
  log(message: string): void;
}

/** A guided mission step shown in the missions panel. */
export interface MissionStep {
  id: string;
  prompt: string;
  /** Hint of something to say, shown on demand. */
  hint: string;
}
