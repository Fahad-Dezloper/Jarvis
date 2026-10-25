// Pure helpers: turn engine actions into short human lines.
// No imports with aliases so this file can be tested directly.

const WINDOW_LABELS = {
  finder: "Finder",
  terminal: "Terminal",
  notes: "Notes",
  safari: "Safari",
  chrome: "Chrome",
  music: "Music",
  settings: "Settings",
  calculator: "Calculator",
  vscode: "VS Code",
  photos: "Photos",
  messages: "Messages",
  calendar: "Calendar",
  weather: "Weather",
  map: "Maps",
  appstore: "App Store",
  appletv: "Apple TV",
  telegram: "Telegram",
  postman: "Postman",
  font: "Font Book",
  contact: "Contact",
  resume: "Resume",
  call: "FaceTime",
  txtfile: "Text file",
  imgfile: "Image",
  launchpad: "Launchpad",
};

export function windowLabel(key) {
  if (!key) return "the window";
  if (WINDOW_LABELS[key]) return WINDOW_LABELS[key];
  const s = String(key).replace(/[_-]+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function clip(value, max = 64) {
  const s = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function humanizeInvoke(action) {
  const args = action.args && typeof action.args === "object" ? action.args : {};
  const key = `${action.app}.${action.name}`;
  switch (key) {
    case "terminal.run_command":
      return `Running: ${clip(args.command)}`;
    case "terminal.clear":
      return "Clearing the terminal";
    case "notes.append_note":
      return `Adding to Notes: "${clip(args.text, 48)}"`;
    case "notes.new_note":
      return args.title ? `Creating note "${clip(args.title, 40)}"` : "Creating a new note";
    case "browser.open_url":
      return `Opening ${clip(args.url, 56)}`;
    case "browser.copy_link":
      return args.element
        ? `Copying the link "${clip(args.element, 40)}"`
        : "Copying the page link";
    case "browser.back":
      return "Going back a page";
    case "music.play":
      return args.query ? `Playing ${clip(args.query, 48)}` : "Resuming music";
    case "music.pause":
      return "Pausing music";
    case "music.next":
      return "Skipping to the next track";
    case "music.previous":
      return "Going to the previous track";
    case "music.set_volume":
      return `Setting volume to ${Math.round(Number(args.level) || 0)}%`;
    case "finder.open":
      return `Opening ${clip(args.name, 48)} in Finder`;
    case "settings.set_theme":
      return `Switching to ${args.theme === "light" ? "light" : "dark"} mode`;
    case "settings.set_setting":
      return `Turning ${clip(args.key, 24)} ${args.value ? "on" : "off"}`;
    default:
      return `${clip(String(action.name || "action").replace(/_/g, " "), 40)} (${windowLabel(action.app)})`;
  }
}

/** @param {any} action  An engine Action. @returns {string} */
export function humanize(action) {
  if (!action || typeof action !== "object") return "Working";
  switch (action.type) {
    case "open":
      return `Opening ${windowLabel(action.window)}`;
    case "close":
      return `Closing ${windowLabel(action.window)}`;
    case "minimize":
      return `Minimizing ${windowLabel(action.window)}`;
    case "maximize":
      return `Maximizing ${windowLabel(action.window)}`;
    case "restore":
      return `Restoring ${windowLabel(action.window)}`;
    case "focus":
      return `Switching to ${windowLabel(action.window)}`;
    case "move":
      return `Moving ${windowLabel(action.window)}`;
    case "resize":
      return `Resizing ${windowLabel(action.window)}`;
    case "tile": {
      const layouts = { grid: "a grid", columns: "columns", rows: "rows", cascade: "a cascade" };
      return `Arranging windows in ${layouts[action.layout] || "a tidy layout"}`;
    }
    case "click":
      return `Clicking ${clip(action.target, 40)} in ${windowLabel(action.window)}`;
    case "type": {
      const where = action.target ? ` into ${clip(action.target, 24)}` : "";
      return `Typing "${clip(action.text, 40)}"${where}`;
    }
    case "invoke":
      return humanizeInvoke(action);
    case "say":
      return clip(action.text, 80) || "Replying";
    default:
      return "Working";
  }
}
