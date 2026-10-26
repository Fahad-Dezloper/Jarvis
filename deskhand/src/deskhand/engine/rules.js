// Deterministic offline planner. No network, no key. Turns dictated text into
// Action[] (see ../contract.js). Dictation is messy, so the first pass strips
// filler and keeps only the last correction ("open notes, no wait, terminal").
import { CLIPBOARD_TOKEN } from "./schema.js";
import { FILE_EXT, planDesktopSegment } from "./rules-desktop.js";

/** Shown when the offline rules cannot understand a command. */
export const OFFLINE_FAIL_MESSAGE =
  "I couldn't match that offline. The AI planner is unavailable right now (quota or connection), so I can only handle common commands. Try: \"open Notes\", \"change the wallpaper to blue\", \"search the web for solana\", \"take a screenshot\".";

const APP_NAMES = {
  terminal: "Terminal",
  music: "Music",
  notes: "Notes",
  safari: "Safari",
  chrome: "Chrome",
  finder: "Finder",
  settings: "Settings",
  calculator: "Calculator",
  vscode: "VS Code",
  photos: "Photos",
  calendar: "Calendar",
  weather: "Weather",
  mail: "Mail",
  messages: "Messages",
  map: "Maps",
  appstore: "App Store",
  telegram: "Telegram",
  postman: "Postman",
  font: "Font Book",
  call: "FaceTime",
  appletv: "Apple TV",
  contact: "Contact",
  resume: "Resume",
  launchpad: "Launchpad",
};

// Spoken names -> window key. Longest names are matched first.
const SYNONYMS = [
  ["terminal", ["claude code", "claude-code", "terminal", "console", "command line", "command prompt", "shell"]],
  ["music", ["spotify", "apple music", "music app", "music player", "music", "songs", "jamendo"]],
  ["notes", ["notepad", "notes app", "notes", "note pad", "notebook"]],
  ["chrome", ["google chrome", "chrome"]],
  ["safari", ["safari", "web browser", "browser", "the web", "internet"]],
  ["finder", ["file manager", "finder", "files"]],
  ["settings", ["system settings", "system preferences", "preferences", "settings"]],
  ["calculator", ["calculator", "calc"]],
  ["vscode", ["visual studio code", "vs code", "vscode", "code editor"]],
  ["photos", ["photos", "gallery"]],
  ["calendar", ["calendar"]],
  ["weather", ["weather"]],
  ["mail", ["mail app", "mail", "inbox"]],
  ["messages", ["messages", "imessage"]],
  ["map", ["maps", "map"]],
  ["appstore", ["app store"]],
  ["telegram", ["telegram"]],
  ["postman", ["postman"]],
  ["font", ["font book", "fontbook"]],
  ["call", ["facetime", "face time"]],
  ["appletv", ["apple tv"]],
  ["contact", ["contact", "contacts"]],
  ["resume", ["resume", "cv"]],
  ["launchpad", ["launchpad"]],
];

const NAME_LIST = SYNONYMS.flatMap(([key, names]) => names.map((n) => ({ key, n })))
  .sort((a, b) => b.n.length - a.n.length);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAME_RE = new RegExp(`(?<![\\w-])(${NAME_LIST.map((x) => esc(x.n)).join("|")})(?![\\w-])`, "gi");

/** Window keys mentioned in a string, in order of appearance, deduplicated. */
export function mentionedApps(str) {
  const out = [];
  for (const m of String(str).matchAll(NAME_RE)) {
    const hit = NAME_LIST.find((x) => x.n === m[1].toLowerCase());
    if (hit && !out.includes(hit.key)) out.push(hit.key);
  }
  return out;
}

const FILLER_LEAD =
  /^(?:(?:hey|hi|hello|ok|okay|so|um+|uh+|er+|erm|like|well|alright|please|just|now|wispr|deskhand|computer|assistant|go ahead and|can you|could you|would you|will you|can we|let's|lets|i want you to|i want to|i would like to|i'd like to|i need you to|i need to|i wanna|you should|you can|kindly|actually)\b[\s,.:-]*)+/i;
const FILLER_INLINE = /[,\s]*\b(?:um+|uh+|er+|erm|you know|kindly|please)\b[,.]?\s*/gi;
const CORRECTION = /(?:,?\s*\b(?:no wait|no no|sorry|scratch that|never ?mind that|i mean|actually no|wait no|rather)\b[,.]?\s+)/i;

export function cleanText(text) {
  let t = String(text ?? "").replace(/\s+/g, " ").trim();
  // keep what follows the last self-correction
  const parts = t.split(CORRECTION);
  if (parts.length > 1 && parts[parts.length - 1].trim().length > 1) t = parts[parts.length - 1];
  t = t.replace(/\s+dot\s+(com|org|net|io|dev|ai|co|app|edu|gov|so)\b/gi, ".$1");
  t = t.replace(FILLER_INLINE, " ").trim();
  t = t.replace(FILLER_LEAD, "");
  t = t.replace(/[\s.!?,;]+$/g, "").replace(/\s+/g, " ").trim();
  return t;
}

const VERBS =
  "open|close|launch|start|play|pause|stop|run|minimi[sz]e|maximi[sz]e|tile|put|write|note|save|turn|set|switch|skip|jot|copy|resize|arrange|make|focus|show|quit|exit|hide|restore|organi[sz]e|type|execute|enable|disable|mute|resume|next|lower|raise|increase|decrease|take|lock|change|create|dim|brighten";

export function splitCommand(text) {
  const seqs = text.split(/\s*(?:,?\s+and then\s+|,?\s+then\s+|,?\s+after that\s+|,?\s+afterwards\s+|;\s*)/i);
  const out = [];
  const andRe = new RegExp(`,?\\s+and\\s+(?:also\\s+)?(?=(?:${VERBS})\\b)`, "i");
  const commaRe = new RegExp(`,\\s+(?:also\\s+)?(?=(?:${VERBS})\\b)`, "i");
  // add/remove/delete/search only split when they clearly start a desktop-style command
  const deskRe = /,?\s+and\s+(?:also\s+)?(?=(?:add|remove|delete|hide|search|rename)\b[^,]*\b(?:widget|dock|folder|file|wallpaper|web|google)\b)/i;
  for (const s of seqs) {
    for (const piece of s.split(andRe)) {
      for (const p2 of piece.split(deskRe)) {
        for (const p of p2.split(commaRe)) if (p.trim()) out.push(p.trim());
      }
    }
  }
  return out;
}

const unquote = (s) => s.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
const GENERIC_MUSIC = /^(?:music|something|some music|a song|songs|some songs|a track|anything|spotify|the music|my music|tunes|some tunes)$/i;
const PRONOUN = /\b(?:it|this|that|them|these|current|front|window|one)\b/i;

function frontWindow(snap) {
  const open = (snap?.windows ?? []).filter((w) => !w.minimized);
  if (snap?.focused && open.some((w) => w.key === snap.focused)) return snap.focused;
  open.sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
  return open[0]?.key ?? null;
}


// ---------- multi-step asks (offline versions) ----------
// These need information back from an app, so the plan carries a `followup`
// descriptor (see followups.js) that the loop resolves from the observations.

const TIME_WORDS =
  /\b(?:today|tonight|tomorrow|day after tomorrow|(?:this|next|on)\s+(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)[a-z]*|(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)[a-z]*day|next (?:week|month)|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|\d{1,2}(?::\d{2})?\s*(?:am|pm)|noon|midnight|in\s+\d+\s+(?:minutes?|hours?|days?|weeks?))\b/i;

const tidy = (s) => s.replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const WORD_OPS = [
  [/\bmultiplied by\b|\btimes\b/gi, "*"],
  [/\bdivided by\b|\bover\b/gi, "/"],
  [/\bplus\b/gi, "+"],
  [/\bminus\b/gi, "-"],
  [/\bto the power of\b/gi, "^"],
  [/(?<=\d)\s*x\s*(?=\d)/gi, "*"],
  [/[×]/g, "*"],
  [/[÷]/g, "/"],
];

function arithmeticExpression(t) {
  const pct = /(\d[\d,.]*)\s*(?:%|percent)\s+of\s+(\d[\d,.]*)/i.exec(t);
  if (pct) return `${pct[1]}% of ${pct[2]}`;
  const m = /^(?:what(?:'s| is)|whats|calculate|compute|how much is|work out|solve|figure out)\s+(.+)$/i.exec(t);
  if (!m) return null;
  let e = m[1];
  for (const [re, to] of WORD_OPS) e = e.replace(re, ` ${to} `);
  e = tidy(e);
  if (/^[\d\s.,+\-*/()^%]+$/.test(e) && /\d/.test(e) && /[+\-*/^%]/.test(e.replace(/^-/, ""))) return e.replace(/\s+/g, " ");
  return null;
}

function parseWhich(t) {
  if (/\b(?:latest|newest|most recent|recent|last)\b/i.test(t)) return "latest";
  if (/\b(?:first|top|1st|best(?: match| result)?)\b/i.test(t)) return "first";
  if (/\b(?:second|2nd)\b/i.test(t)) return "2";
  if (/\b(?:third|3rd)\b/i.test(t)) return "3";
  return "first";
}

/**
 * @returns {import("../contract").PlanResult & {done:boolean, followup?:object}} | null
 */
function planComplex(cleaned, ctx) {
  const snap = ctx.snapshot ?? null;
  const t = cleaned;
  // widget / dock / wallpaper asks belong to the desktop rules (they mention weather, calendar, music...)
  if (/\b(?:widgets?|dock|wallpaper|background)\b/i.test(t)) return null;
  const visible = new Set((snap?.windows ?? []).filter((w) => !w.minimized).map((w) => w.key));
  const out = (actions, reply, followup) => ({
    actions,
    reply,
    source: "rules",
    done: !followup,
    ...(followup ? { followup } : {}),
    ...(ctx.note ? { note: ctx.note } : {}),
  });
  const openIf = (key) => (visible.has(key) ? [] : [{ type: "open", window: key }]);
  let m;

  // --- read the open project and explain it (Claude Code) ---
  const asksProject =
    /\b(?:read|explain|summari[sz]e|understand|go through|look (?:at|through)|analy[sz]e|review|tell me (?:what|about)|what(?:'s| is| does)|walk me through)\b/i.test(t) &&
    /\b(?:project|folder|repo(?:sitory)?|codebase|everything|code base)\b/i.test(t);
  if (asksProject && (/\b(?:claude code|terminal)\b/i.test(t) || /\b(?:this|the|my|open)\s+(?:project|codebase|repo|folder)\b/i.test(t)) && !/\bnotes?\b/i.test(t)) {
    return out(
      [
        ...openIf("terminal"),
        { type: "invoke", app: "terminal", name: "run_command", args: { command: 'claude "read this project and explain it"' } },
        { type: "invoke", app: "terminal", name: "read_project", args: {} },
      ],
      "Opening Claude Code and reading the project.",
      { kind: "project_summary" },
    );
  }

  // --- browser search (optionally open a result) ---
  if (
    (m = /^(?:(?:open|launch|start|go to)\s+(?:the\s+)?(?:google\s+)?(chrome|safari|browser|web browser)(?:\s+browser)?[\s,]*(?:and\s+)?(?:then\s+)?)?(?:search(?:\s+the web)?|google|look up|look for|find|research)\s+(?:for\s+|up\s+)?(.+)$/i.exec(t)) &&
    (m[1] || /^(?:search|google|look up)/i.test(t)) &&
    !/^(?:search|find|look for)\s+(?:my|the)\s+(?:mac|computer|desktop|files|laptop)\b/i.test(t)
  ) {
    let q = m[2];
    let opened = false;
    let which = "first";
    const tail = /^(.*?)[\s,]+(?:and\s+)?(?:then\s+)?(?:open|click|go to|show(?: me)?|pull up|read)\s+(?:me\s+)?(?:the\s+|a\s+)?(.*)$/i.exec(q);
    if (tail) {
      q = tail[1];
      opened = true;
      which = parseWhich(tail[2]);
    }
    const read = !!tail && /\b(?:summari[sz]e|summary|read|tell me|explain)\b/i.test(tail[2]);
    q = tidy(q.replace(/^(?:the web|the internet|online|google|bing)\s+(?:for\s+)?/i, "").replace(/\s+(?:for me|please|online|on the web|on google|in (?:chrome|safari|the browser))$/i, ""));
    if (q) {
      const papers = /\b(?:papers?|research|paradigm|arxiv|study|studies|journal)\b/i.test(q);
      const browser = /\bsafari\b/i.test(t) ? "safari" : "chrome";
      const actions = [
        ...openIf(browser),
        { type: "invoke", app: "browser", name: "search", args: { query: q, source: papers ? "papers" : "web" } },
        ...(opened ? [{ type: "invoke", app: "browser", name: "open_result", args: { which } }] : []),
        ...(read ? [{ type: "invoke", app: "browser", name: "read_page", args: {} }] : []),
      ];
      return out(actions, `Searching for ${q}${opened ? " and opening the result" : ""}.`, { kind: "search_report", opened, ...(read ? { read: true } : {}) });
    }
  }

  // --- arithmetic ---
  const expr = (arithmeticExpression(t) || "").replace(/[\s,.;:!?]+$/g, "");
  if (expr) {
    return out([...openIf("calculator"), { type: "invoke", app: "calculator", name: "compute", args: { expression: expr } }], `Calculating ${expr}.`, { kind: "answer" });
  }

  // --- weather ---
  if ((!/\bwidget\b/i.test(t) && (m = /\bweather\b.*?\b(?:in|for|at|of)\s+(.+)$/i.exec(t))) || (m = /\bhow(?:'s| is)\s+(?:it|the weather)\s+(?:looking\s+)?(?:in|at)\s+(.+)$/i.exec(t))) {
    const city = tidy(m[1].replace(/\b(?:today|tonight|tomorrow|right now|now|please|like)\b/gi, ""));
    if (city) {
      return out([...openIf("weather"), { type: "invoke", app: "weather", name: "show", args: { city } }], `Checking the weather in ${city}.`, { kind: "answer" });
    }
  }

  // --- mail ---
  if ((m = /^(?:send\s+(?:an?\s+)?e-?mail\s+to|write\s+(?:an?\s+)?e-?mail\s+to|compose\s+(?:an?\s+)?e-?mail\s+to|e-?mail|mail)\s+(\S+)\s*(.*)$/i.exec(t))) {
    const to = m[1].replace(/[,.]+$/, "");
    let rest = tidy(m[2]);
    let body;
    const saying = /^(?:saying|that says|telling (?:him|her|them)|with the message|and say|and tell (?:him|her|them))\s+(.+)$/i.exec(rest);
    const about = /^(?:about|regarding|re:?)\s+(.+)$/i.exec(rest);
    if (saying) {
      body = saying[1];
      rest = "";
    } else if (about) rest = about[1];
    rest = tidy(rest.replace(/^the\s+/i, ""));
    const subject = rest ? capital(rest) : "";
    if (!body) body = rest ? `Hi ${capital(to)}, here are the ${rest.replace(/^(?:my|our)\s+/i, "")}.` : `Hi ${capital(to)},`;
    return out(
      [...openIf("mail"), { type: "invoke", app: "mail", name: "compose", args: { to, subject, body } }],
      `Drafting an email to ${capital(to)}. Say "send it" when you want it sent.`,
      { kind: "answer" },
    );
  }
  if (/^send\s+(?:it|the e-?mail|this e-?mail|the message|that)\s*(?:now)?$/i.test(t) && visible.has("mail")) {
    return out([{ type: "invoke", app: "mail", name: "send", args: {} }], "Sending the email.", { kind: "answer" });
  }

  // --- calendar ---
  if ((m = /^(?:add|put|schedule|create|set up|book|make)\s+(?:an?\s+)?(?:event\s+|meeting\s+)?(.+?)(?:\s+(?:to|on|in|into|onto)\s+(?:my\s+|the\s+)?calendar)(?:\s+(.*))?$/i.exec(t)) ||
      (m = /^schedule\s+(.+)$/i.exec(t))) {
    let title = tidy(m[1]);
    let when = tidy(m[2] ?? "");
    const tm = TIME_WORDS.exec(title);
    if (tm) {
      when = tidy(`${title.slice(tm.index)} ${when}`);
      title = tidy(title.slice(0, tm.index));
    }
    title = title.replace(/\s+(?:on|at|for)$/i, "");
    if (title) {
      return out(
        [...openIf("calendar"), { type: "invoke", app: "calendar", name: "add_event", args: { title: capital(title), ...(when ? { when } : {}) } }],
        `Adding ${title}${when ? ` ${when}` : ""} to your calendar.`,
        { kind: "answer" },
      );
    }
  }
  if (/\b(?:what(?:'s| is)|whats|show|read|list|check)\b.*\b(?:on |in )?(?:my )?(?:calendar|schedule|agenda)\b/i.test(t) || /\bwhat do i have (?:today|tomorrow|coming up|on)\b/i.test(t)) {
    return out([...openIf("calendar"), { type: "invoke", app: "calendar", name: "list_events", args: {} }], "Checking your calendar.", { kind: "answer" });
  }
  return null;
}

/**
 * @param {string} text
 * @param {{history?:{command:string,reply:string}[], snapshot?:object}} [ctx]
 * @returns {import("../contract").PlanResult & {done:boolean, followup?:object}}
 */
export function planWithRules(text, ctx = {}) {
  const snap = ctx.snapshot ?? null;
  const cleaned = cleanText(text);
  const complex = planComplex(cleaned, ctx);
  if (complex) return complex;
  const segments = splitCommand(cleaned);
  const actions = [];
  const phrases = [];
  const unknown = [];

  // plan-local picture of the desktop
  const openNow = new Set((snap?.windows ?? []).filter((w) => !w.minimized).map((w) => w.key));
  const knownOpen = new Set((snap?.windows ?? []).map((w) => w.key));
  let last = null;

  const historyApp = () => {
    const h = ctx.history ?? [];
    for (let i = h.length - 1; i >= 0; i--) {
      const apps = mentionedApps(h[i].command ?? "");
      for (let j = apps.length - 1; j >= 0; j--) {
        if (!snap || knownOpen.has(apps[j]) || openNow.has(apps[j])) return apps[j];
      }
    }
    return null;
  };
  const pronounTarget = (word) => {
    if (last) return last;
    if (/\bit\b/i.test(word)) return historyApp() ?? frontWindow(snap);
    return frontWindow(snap) ?? historyApp();
  };
  const pickBrowser = () => {
    if (openNow.has("chrome") && !openNow.has("safari")) return "chrome";
    return "safari";
  };
  const need = (key) => {
    if (!openNow.has(key)) {
      actions.push({ type: "open", window: key });
      openNow.add(key);
      knownOpen.add(key);
    }
    last = key;
  };
  const push = (a, phrase) => {
    actions.push(a);
    if (phrase) phrases.push(phrase);
  };
  const nm = (k) => APP_NAMES[k] ?? k;
  const resolveTargets = (rest, whole) => {
    const apps = mentionedApps(rest);
    if (apps.length) return apps.map((a) => (a === "safari" && /\bchrome\b/i.test(rest) ? "chrome" : a));
    if (PRONOUN.test(rest) || !rest.trim()) {
      const t = pronounTarget(whole);
      return t ? [t] : [];
    }
    return [];
  };

  let followup = null;
  for (const seg of segments) {
    const low = seg.toLowerCase();
    let m;
    const startLen = actions.length;

    // ----- desktop, system and real-web asks (wallpaper, widgets, dock, files, search, ...) -----
    const desk = planDesktopSegment(seg, { snap, mentionedApps, appName: nm, pickBrowser, openNow });
    if (desk) {
      for (const key of desk.needs ?? []) need(key);
      for (const a of desk.actions) actions.push(a);
      phrases.push(desk.phrase);
      if (desk.followup) followup = desk.followup;
      continue;
    }

    // ----- save a link to notes -----
    if (
      /\b(?:save|copy|add|send|put|store|jot|write|bookmark)\b/.test(low) &&
      /\b(?:link|url|address|page|site|website)\b/.test(low) &&
      /\b(?:notes?|notepad)\b/.test(low)
    ) {
      const label = /\bthe\s+(.+?)\s+(?:link|url)\b/i.exec(seg)?.[1];
      const element = label && !/^(?:this|that|current|same|last|open)$/i.test(label) ? label : "";
      const browser = pickBrowser();
      need(browser);
      push({ type: "invoke", app: "browser", name: "copy_link", args: element ? { element } : {} }, "copying the link");
      need("notes");
      push({ type: "invoke", app: "notes", name: "append_note", args: { text: CLIPBOARD_TOKEN } }, "saving it to Notes");
      continue;
    }

    // ----- type X into app -----
    if ((m = /^(?:type|enter|input)\s+(.+?)(?:\s+(?:in|into|on|inside)\s+(?:the\s+|my\s+)?(.+))?$/i.exec(seg))) {
      const payload = unquote(m[1]);
      let app = m[2] ? mentionedApps(m[2])[0] : null;
      if (!app) {
        const f = frontWindow(snap);
        app = f ?? null;
        if (!m[2] && !f && /^(?:npm|git|ls|cd|node|pnpm|yarn|bun|python|pip|docker|claude)\b/i.test(payload)) app = "terminal";
      }
      if (app === "terminal") {
        need("terminal");
        push({ type: "invoke", app: "terminal", name: "run_command", args: { command: payload } }, `running ${payload}`);
        continue;
      }
      if (app === "notes") {
        need("notes");
        push({ type: "invoke", app: "notes", name: "append_note", args: { text: payload } }, "adding that to Notes");
        continue;
      }
      if (app) {
        push({ type: "type", window: app, text: payload }, `typing into ${nm(app)}`);
        continue;
      }
    }

    // ----- run / execute in terminal -----
    if (
      (m = /^(?:run|execute|launch command)\s+(.+?)(?:\s+(?:in|on|into|inside|using|with)\s+(?:the\s+|my\s+)?(?:terminal|console|claude code|shell|command line))?$/i.exec(seg)) &&
      (/\b(?:terminal|console|claude code|shell)\b/i.test(seg) ||
        !mentionedApps(m[1]).some((a) => a !== "terminal") ||
        /^(?:npm|npx|git|node|pnpm|yarn|bun|python3?|pip|docker|ls|cd|cat|echo|make|claude)\b/i.test(m[1]))
    ) {
      const cmd = unquote(m[1]);
      if (cmd) {
        need("terminal");
        push({ type: "invoke", app: "terminal", name: "run_command", args: { command: cmd } }, `running ${cmd}`);
        continue;
      }
    }
    if ((m = /^(?:ask|tell)\s+claude(?: code)?\s+to\s+(.+)$/i.exec(seg))) {
      need("terminal");
      push({ type: "invoke", app: "terminal", name: "run_command", args: { command: unquote(m[1]) } }, "sending that to Claude Code");
      continue;
    }
    if (/^(?:clear)\b/.test(low) && /\b(?:terminal|console|screen)\b/.test(low)) {
      need("terminal");
      push({ type: "invoke", app: "terminal", name: "clear", args: {} }, "clearing the terminal");
      continue;
    }

    // ----- volume -----
    if ((m = /\b(?:volume|sound|audio)\b.*?\b(?:to|at)\s+(\d{1,3})\s*(?:%|percent)?/i.exec(seg)) || (m = /\bset\s+(?:the\s+)?(?:volume|sound)\s+(\d{1,3})/i.exec(seg))) {
      const level = Math.min(100, Number(m[1]));
      push({ type: "invoke", app: "music", name: "set_volume", args: { level } }, `setting the volume to ${level}`);
      continue;
    }
    if (/\b(?:volume|sound|louder|quieter|softer|turn (?:it|the music|the sound) (?:up|down))\b/.test(low) && /\b(up|down|louder|quieter|softer|raise|lower|increase|decrease|higher|turn up|turn down)\b/.test(low)) {
      const cur = snap?.music?.volume ?? 72;
      const up = /\b(up|louder|raise|increase|higher)\b/.test(low);
      const level = Math.max(0, Math.min(100, cur + (up ? 15 : -15)));
      push({ type: "invoke", app: "music", name: "set_volume", args: { level } }, up ? "turning it up" : "turning it down");
      continue;
    }
    if (/^mute\b/.test(low)) {
      push({ type: "invoke", app: "music", name: "set_volume", args: { level: 0 } }, "muting the music");
      continue;
    }

    // ----- music transport -----
    if ((m = /^(?:play|put on|start playing|listen to|queue up)\b\s*(.*)$/i.exec(seg))) {
      let q = unquote(m[1])
        .replace(/^(?:the|some|my|a|me)\s+/i, "")
        .replace(/\s+(?:on|in|using)\s+(?:the\s+)?(?:spotify|music(?: app)?)$/i, "")
        .replace(/\s+(?:playlist|album|list)$/i, "")
        .replace(/^(?:the|some|my)\s+/i, "")
        .trim();
      need("music");
      if (!q || GENERIC_MUSIC.test(q)) {
        push({ type: "invoke", app: "music", name: "play", args: {} }, "playing music");
      } else {
        push({ type: "invoke", app: "music", name: "play", args: { query: q } }, `playing ${q}`);
      }
      continue;
    }
    if (/^(?:resume|continue|unpause)\b/.test(low) && !/\b(?:window|terminal)\b/.test(low)) {
      push({ type: "invoke", app: "music", name: "play", args: {} }, "resuming the music");
      continue;
    }
    if (/^(?:pause|stop|hold)\b/.test(low) && (/\b(?:music|song|songs|track|playing|playback|it|spotify|audio|that)\b/.test(low) || /^(?:pause|stop)$/.test(low))) {
      push({ type: "invoke", app: "music", name: "pause", args: {} }, "pausing the music");
      continue;
    }
    if (/^(?:next|skip)\b/.test(low) || /\b(?:next|skip)\s+(?:song|track|one)\b/.test(low)) {
      push({ type: "invoke", app: "music", name: "next", args: {} }, "skipping to the next track");
      continue;
    }
    if (/^(?:previous|prev|last)\b/.test(low) || /\b(?:previous|last)\s+(?:song|track)\b/.test(low) || /\bgo back a (?:song|track)\b/.test(low)) {
      push({ type: "invoke", app: "music", name: "previous", args: {} }, "going to the previous track");
      continue;
    }

    // ----- browser -----
    if (/^(?:go|navigate)\s+back\b/.test(low) || /^back$/.test(low)) {
      push({ type: "invoke", app: "browser", name: "back", args: {} }, "going back");
      continue;
    }
    if ((m = /^(?:open|go to|visit|browse to|navigate to)\s+((?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?)$/i.exec(seg)) && !mentionedApps(m[1]).length && !FILE_EXT.test(m[1])) {
      need(pickBrowser());
      push({ type: "invoke", app: "browser", name: "open_url", args: { url: m[1] } }, `opening ${m[1]}`);
      continue;
    }
    if (/\bcopy\b.*\b(?:link|url)\b/.test(low)) {
      need(pickBrowser());
      push({ type: "invoke", app: "browser", name: "copy_link", args: {} }, "copying the link");
      continue;
    }

    // ----- notes -----
    if (/\b(?:new|create|start|open)\s+(?:a\s+)?(?:new\s+)?note\b/.test(low) && !/\bnotes\b/.test(low)) {
      need("notes");
      push({ type: "invoke", app: "notes", name: "new_note", args: {} }, "starting a new note");
      continue;
    }
    if (
      (m = /^(?:write down|write|note down|note|jot down|jot|take a note|make a note|add a note|remember|add to (?:my )?notes?|put in (?:my )?notes?)\b[\s,:-]*(?:that|this|to)?\s*(.*)$/i.exec(seg))
    ) {
      const body = unquote(m[1].replace(/\s+(?:in|into|to|on)\s+(?:my\s+|the\s+)?(?:notes?|notepad|notes app)$/i, ""));
      need("notes");
      if (body) push({ type: "invoke", app: "notes", name: "append_note", args: { text: body } }, "noting that down");
      else push({ type: "invoke", app: "notes", name: "new_note", args: {} }, "starting a new note");
      continue;
    }

    // ----- settings -----
    if (/\b(?:dark|night)\s*(?:mode|theme)\b|\bdark\b/.test(low) && !/\bnight light\b/.test(low)) {
      const off = /\b(?:off|disable|stop)\b/.test(low) || /\blight\b/.test(low);
      push({ type: "invoke", app: "settings", name: "set_theme", args: { theme: off ? "light" : "dark" } }, off ? "switching to light mode" : "switching to dark mode");
      continue;
    }
    if (/\b(?:light)\s*(?:mode|theme)\b/.test(low)) {
      push({ type: "invoke", app: "settings", name: "set_theme", args: { theme: "light" } }, "switching to light mode");
      continue;
    }
    if ((m = /\b(wi-?fi|bluetooth|focus mode|do not disturb|dnd|night light|night shift|vpn)\b/i.exec(seg))) {
      const word = m[1].toLowerCase();
      const key = /wi-?fi/.test(word) ? "wifi" : word === "bluetooth" ? "bluetooth" : /focus|disturb|dnd/.test(word) ? "focusMode" : /night/.test(word) ? "nightLight" : "vpn";
      let value;
      if (/\b(?:off|disable|disconnect|deactivate|stop)\b/.test(low)) value = false;
      else if (/\b(?:on|enable|connect|activate|start)\b/.test(low)) value = true;
      else value = !(snap?.settings?.[key] ?? false);
      push({ type: "invoke", app: "settings", name: "set_setting", args: { key, value } }, `turning ${word} ${value ? "on" : "off"}`);
      continue;
    }

    // ----- half-screen placement -----
    if (
      (m = /^(?:put|move|snap|place|dock|send|drag|pin|slide)\s+(.+?)\s+(?:on|to|in|at|onto)\s+(?:the\s+)?(left|right|top|bottom)(?:\s+(?:half|side|part))?(?:\s+of\s+(?:the\s+)?screen)?$/i.exec(seg)) ||
      (m = /^(.+?)\s+(?:on|to)\s+the\s+(left|right|top|bottom)\s+(?:half|side)$/i.exec(seg))
    ) {
      const targets = resolveTargets(m[1], seg);
      if (targets.length) {
        const side = m[2].toLowerCase();
        const vp = snap?.viewport ?? { width: 1440, height: 900, top: 35, bottom: 810 };
        const gap = 8;
        const areaH = vp.bottom - vp.top - gap * 2;
        const horizontal = side === "left" || side === "right";
        for (const t of targets) {
          need(t);
          const width = horizontal ? Math.round(vp.width / 2 - gap * 1.5) : vp.width - gap * 2;
          const height = horizontal ? areaH : Math.round(areaH / 2 - gap / 2);
          const x = side === "right" ? Math.round(vp.width / 2 + gap / 2) : gap;
          const y = side === "bottom" ? vp.top + gap + Math.round(areaH / 2 + gap / 2) : vp.top + gap;
          actions.push({ type: "resize", window: t, width, height });
          actions.push({ type: "move", window: t, x, y });
        }
        phrases.push(`putting ${targets.map(nm).join(" and ")} on the ${side}`);
        continue;
      }
    }

    // ----- tiling -----
    if (
      /\b(?:tile|arrange|organi[sz]e|line up|lay ?out|tidy|clean up|cascade|stack)\b/.test(low) ||
      (/\bwindows?\b/.test(low) && /\b(?:resize|fit|make|rearrange|sort|space)\b/.test(low) && /\b(?:look|good|nice|neat|tidy|better|fit|all|screen|organi[sz]ed)\b/.test(low)) ||
      /\bside by side\b/.test(low)
    ) {
      const layout = /\bcascade\b/.test(low) ? "cascade" : /\b(?:side by side|columns?|vertical)\b/.test(low) ? "columns" : /\b(?:rows?|stack|horizontal|on top of each other)\b/.test(low) ? "rows" : "grid";
      const named = mentionedApps(seg).filter((k) => openNow.has(k) || !snap);
      const a = { type: "tile", layout };
      if (named.length > 1) a.windows = named;
      push(a, `tiling ${named.length > 1 ? named.map(nm).join(" and ") : "your windows"} in a ${layout}`);
      continue;
    }

    // ----- window verbs -----
    const all = /\b(?:all|everything|every window|all windows|all apps|them all)\b/.test(low);
    const verb = (re) => (m = re.exec(seg));
    if (verb(/^(?:close|quit|exit|kill|shut(?: down)?|dismiss|get rid of|x out)\b\s*(.*)$/i)) {
      if (all) {
        const keys = [...new Set([...openNow, ...knownOpen])].filter((k) => openNow.has(k) || knownOpen.has(k));
        for (const k of keys) {
          actions.push({ type: "close", window: k });
          openNow.delete(k);
          knownOpen.delete(k);
        }
        phrases.push(keys.length ? "closing all windows" : "nothing was open");
        if (!keys.length) actions.push({ type: "say", text: "No windows are open." });
        continue;
      }
      const targets = resolveTargets(m[1], seg);
      if (targets.length) {
        for (const t of targets) {
          actions.push({ type: "close", window: t });
          openNow.delete(t);
        }
        last = null;
        phrases.push(`closing ${targets.map(nm).join(" and ")}`);
        continue;
      }
    }
    if (verb(/^(?:minimi[sz]e|hide|put away|tuck away|shrink)\b\s*(.*)$/i)) {
      const keys = all ? [...openNow] : resolveTargets(m[1], seg);
      if (keys.length) {
        for (const t of keys) {
          actions.push({ type: "minimize", window: t });
          openNow.delete(t);
        }
        phrases.push(`minimizing ${all ? "everything" : keys.map(nm).join(" and ")}`);
        continue;
      }
    }
    if (
      verb(/^(?:maximi[sz]e|expand|enlarge|full[- ]?screen)\b\s*(.*)$/i) ||
      verb(/^(?:make|put|set)\s+(.+?)\s+(?:full[- ]?screen|fullscreen|bigger|larger|as big as possible|fill the screen)$/i) ||
      verb(/^(?:go|switch)\s+full[- ]?screen\b\s*(.*)$/i)
    ) {
      const targets = resolveTargets(m[1] ?? "", seg);
      if (targets.length) {
        for (const t of targets) {
          need(t);
          actions.push({ type: "maximize", window: t });
        }
        phrases.push(`maximizing ${targets.map(nm).join(" and ")}`);
        continue;
      }
    }
    if (verb(/^(?:restore|unminimi[sz]e|un-?maximi[sz]e|bring back|normal size)\b\s*(.*)$/i)) {
      const targets = resolveTargets(m[1], seg);
      if (targets.length) {
        for (const t of targets) {
          actions.push({ type: "restore", window: t });
          openNow.add(t);
        }
        phrases.push(`restoring ${targets.map(nm).join(" and ")}`);
        continue;
      }
    }
    if (verb(/^(?:focus(?: on)?|switch to|jump to|activate|bring)\b\s*(.*?)(?:\s+to (?:the )?front)?$/i)) {
      const targets = resolveTargets(m[1], seg);
      if (targets.length) {
        for (const t of targets) {
          if (openNow.has(t)) actions.push({ type: "focus", window: t });
          else need(t);
        }
        last = targets[targets.length - 1];
        phrases.push(`switching to ${targets.map(nm).join(" and ")}`);
        continue;
      }
    }
    if (verb(/^(?:open|launch|start|fire up|show(?: me)?|bring up|pull up|go to|boot up|load|run up)\b\s*(.*)$/i)) {
      const rest = m[1];
      const targets = resolveTargets(rest, seg).map((t) => (t === "safari" && /\b(?:browser|web)\b/i.test(rest) && openNow.has("chrome") && !openNow.has("safari") ? "chrome" : t));
      if (targets.length) {
        for (const t of targets) {
          if (openNow.has(t)) actions.push({ type: "focus", window: t });
          else need(t);
          last = t;
        }
        phrases.push(`opening ${targets.map(nm).join(" and ")}`);
        continue;
      }
      if (rest.trim()) {
        unknown.push(seg);
        continue;
      }
    }
    if (verb(/^(.+?)\s*(?:please)?$/i) && mentionedApps(seg).length === 1 && seg.split(/\s+/).length <= 3 && actions.length === startLen) {
      // bare app name: "terminal", "notes" -> open it
      const t = mentionedApps(seg)[0];
      need(t);
      phrases.push(`opening ${nm(t)}`);
      continue;
    }

    unknown.push(seg);
  }

  const sayOnly = actions.length > 0 && actions.every((a) => a.type === "say");
  if (!actions.length || sayOnly) {
    const reply = unknown.length ? OFFLINE_FAIL_MESSAGE : "No windows are open.";
    return { actions: sayOnly ? actions : [], reply: sayOnly ? "No windows are open." : reply, source: "rules", done: true, ...(ctx.note ? { note: ctx.note } : {}) };
  }

  let reply = phrases.length ? phrases.join(", then ") : "Done";
  reply = reply.charAt(0).toUpperCase() + reply.slice(1) + ".";
  if (unknown.length) reply += ` I couldn't handle: "${unknown.join('", "')}".`;
  return {
    actions: actions.slice(0, 12),
    reply,
    source: "rules",
    done: !followup,
    ...(followup ? { followup } : {}),
    ...(ctx.note ? { note: ctx.note } : {}),
  };
}
