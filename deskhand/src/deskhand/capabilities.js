// Canonical capability names per app group. Apps implement these through
// bridge.registerHandlers; the engine and the offline parser target the same
// names. Add one here before using it anywhere else.

const str = (description) => ({ type: "string", description });

export const CAPABILITIES = {
  terminal: [
    { name: "run_command", description: "Type and run a command in the terminal (a simulated Claude Code session).", params: { type: "object", properties: { command: str("Command or request") }, required: ["command"] } },
    { name: "clear", description: "Clear the terminal.", params: { type: "object", properties: {} } },
    { name: "read_project", description: "Read the files of the open project (listing plus contents) and return them so the project can be summarised. Optional path narrows it.", params: { type: "object", properties: { path: str("Optional file or folder") } } },
  ],
  notes: [
    { name: "append_note", description: "Add a line of text to the current note.", params: { type: "object", properties: { text: str("Text to append") }, required: ["text"] } },
    { name: "new_note", description: "Create a new note.", params: { type: "object", properties: { title: str("Optional title") } } },
  ],
  browser: [
    { name: "open_url", description: "Open a page by id, link label or URL.", params: { type: "object", properties: { url: str("Page id, link label or URL") }, required: ["url"] } },
    { name: "copy_link", description: "Copy the URL of a link on the page (by label), or the current page URL when empty, to the clipboard.", params: { type: "object", properties: { element: str("Link label; empty for the current page") } } },
    { name: "back", description: "Go back one page.", params: { type: "object", properties: {} } },
    { name: "search", description: "Search and show results. source 'papers' searches research papers (arXiv and a curated index), 'web' searches the demo web index.", params: { type: "object", properties: { query: str("Search query"), source: { type: "string", enum: ["web", "papers"] } }, required: ["query"] } },
    { name: "open_result", description: "Open a search result: 'latest' (newest by date), 'first', a number, or part of a title.", params: { type: "object", properties: { which: str("latest | first | 1-based number | title text") }, required: ["which"] } },
    { name: "read_page", description: "Return the visible text of the current page so it can be summarised.", params: { type: "object", properties: {} } },
  ],
  music: [
    { name: "play", description: "Play a track or a playlist by name (for example 'HiNV Music'). With no query, resume.", params: { type: "object", properties: { query: str("Track or playlist name") } } },
    { name: "pause", description: "Pause playback.", params: { type: "object", properties: {} } },
    { name: "next", description: "Next track.", params: { type: "object", properties: {} } },
    { name: "previous", description: "Previous track.", params: { type: "object", properties: {} } },
    { name: "set_volume", description: "Set volume 0 to 100.", params: { type: "object", properties: { level: { type: "number", minimum: 0, maximum: 100 } }, required: ["level"] } },
  ],
  finder: [
    { name: "open", description: "Open a file or folder by name.", params: { type: "object", properties: { name: str("Name") }, required: ["name"] } },
    { name: "read_file", description: "Return the text of a file by name.", params: { type: "object", properties: { name: str("File name") }, required: ["name"] } },
  ],
  mail: [
    { name: "compose", description: "Start a new email with recipient, subject and body.", params: { type: "object", properties: { to: str("Recipient"), subject: str("Subject"), body: str("Body") }, required: ["to"] } },
    { name: "send", description: "Send the email being composed (simulated).", params: { type: "object", properties: {} } },
  ],
  calendar: [
    { name: "add_event", description: "Add an event to the calendar.", params: { type: "object", properties: { title: str("Event title"), when: str("When, e.g. 'tomorrow 3pm'") }, required: ["title"] } },
    { name: "list_events", description: "Return upcoming events.", params: { type: "object", properties: {} } },
  ],
  calculator: [
    { name: "compute", description: "Evaluate an arithmetic expression and show it.", params: { type: "object", properties: { expression: str("Expression, e.g. '18% of 2450'") }, required: ["expression"] } },
  ],
  weather: [
    { name: "show", description: "Show the weather for a city and return a short description.", params: { type: "object", properties: { city: str("City name") }, required: ["city"] } },
  ],
  settings: [
    { name: "set_theme", description: "Switch light or dark mode.", params: { type: "object", properties: { theme: { type: "string", enum: ["light", "dark"] } }, required: ["theme"] } },
    { name: "set_setting", description: "Toggle a system setting: wifi, bluetooth, focusMode, nightLight, vpn.", params: { type: "object", properties: { key: str("Setting key"), value: { type: "boolean" } }, required: ["key", "value"] } },
  ],
};

/** Window keys that share one capability group. */
export const WINDOW_TO_GROUP = {
  terminal: "terminal",
  notes: "notes",
  safari: "browser",
  chrome: "browser",
  music: "music",
  finder: "finder",
  settings: "settings",
  mail: "mail",
  calendar: "calendar",
  calculator: "calculator",
  weather: "weather",
};
