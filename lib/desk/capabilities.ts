import type { AppCapability, AppId } from "./types";

const str = (description: string) => ({ type: "string", description });

/**
 * Canonical capability names and arguments for each app. Apps return their own
 * list from here, and the offline parser targets the same names, so the two
 * cannot drift. Add a capability here before using it anywhere else.
 */
export const CAPABILITY_CATALOG: Record<AppId, AppCapability[]> = {
  terminal: [
    {
      name: "run_command",
      description: "Run a command in the simulated Claude Code terminal and show its output.",
      params: { type: "object", properties: { command: str("The command or request to run") }, required: ["command"] },
    },
    { name: "clear", description: "Clear the terminal screen.", params: { type: "object", properties: {} } },
  ],
  notes: [
    {
      name: "append_note",
      description: "Add a line of text to the current note.",
      params: { type: "object", properties: { text: str("Text to append") }, required: ["text"] },
    },
    {
      name: "new_note",
      description: "Create a new note and make it current.",
      params: { type: "object", properties: { title: str("Optional title") } },
    },
    {
      name: "set_text",
      description: "Replace the whole text of the current note.",
      params: { type: "object", properties: { text: str("New text") }, required: ["text"] },
    },
  ],
  browser: [
    {
      name: "open_url",
      description: "Open a page in the browser. Accepts a known page id, a link label, or a URL.",
      params: { type: "object", properties: { url: str("Page id, link label or URL") }, required: ["url"] },
    },
    {
      name: "copy_link",
      description: "Copy the URL of a link on the page (by element id or label) to the clipboard.",
      params: { type: "object", properties: { element: str("Element id or label; empty for the current page URL") } },
    },
    { name: "back", description: "Go back one page.", params: { type: "object", properties: {} } },
  ],
  music: [
    {
      name: "play",
      description: "Play a track or a playlist by name. With no query, resume playback.",
      params: { type: "object", properties: { query: str("Track or playlist name, e.g. 'HiNV Music'") } },
    },
    { name: "pause", description: "Pause playback.", params: { type: "object", properties: {} } },
    { name: "next", description: "Skip to the next track.", params: { type: "object", properties: {} } },
    { name: "previous", description: "Go to the previous track.", params: { type: "object", properties: {} } },
    {
      name: "set_volume",
      description: "Set volume from 0 to 100.",
      params: { type: "object", properties: { level: { type: "number", minimum: 0, maximum: 100 } }, required: ["level"] },
    },
  ],
  files: [
    {
      name: "open",
      description: "Open a file or folder by name.",
      params: { type: "object", properties: { name: str("File or folder name") }, required: ["name"] },
    },
    {
      name: "create_folder",
      description: "Create a folder in the current location.",
      params: { type: "object", properties: { name: str("Folder name") }, required: ["name"] },
    },
  ],
  settings: [
    {
      name: "set_wallpaper",
      description: "Change the desktop wallpaper by name (aurora, dusk, graphite, forest).",
      params: { type: "object", properties: { name: str("Wallpaper name") }, required: ["name"] },
    },
    {
      name: "set_theme",
      description: "Switch between light and dark.",
      params: { type: "object", properties: { theme: { type: "string", enum: ["light", "dark"] } }, required: ["theme"] },
    },
  ],
};
