// Offline rules for the whole-desktop and real-web asks: wallpaper, widgets,
// dock, desktop files, launchpad, spotlight, lock, screenshot, brightness,
// system volume, "open <site>" and "search the web for X". One segment of
// dictated text in, an optional plan fragment out:
//   { actions, phrase, needs?: string[], followup?: {kind, opened?} }
// `needs` lists window keys the caller must open first (the caller knows what
// is already open). No DOM, no aliases: runs under tsx and on the server.

const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/^[\s,.!?-]+|[\s,.!?-]+$/g, "").trim();
const unquote = (s) => s.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const inv = (app, name, args = {}) => ({ type: "invoke", app, name, args });

const NUM_WORDS = { zero: 0, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, "a hundred": 100, "one hundred": 100, half: 50, full: 100, max: 100, maximum: 100, minimum: 0, min: 0 };

/** First 0-100 level in the text: digits ("40", "40%") or a tens word ("fifty"). */
export function parseLevel(text) {
  const d = /(\d{1,3})(?:\s*(?:%|percent))?/.exec(text);
  if (d) return Math.max(0, Math.min(100, Number(d[1])));
  const w = new RegExp(`\\b(${Object.keys(NUM_WORDS).sort((a, b) => b.length - a.length).join("|")})\\b`, "i").exec(text);
  return w ? NUM_WORDS[w[1].toLowerCase()] : null;
}

/** "top left", "upper-right", "bottom right corner", "center" -> catalog enum value, or null. */
export function parsePosition(text) {
  const t = String(text).toLowerCase().replace(/\b(?:upper|top)\b/g, "top").replace(/\b(?:lower|bottom)\b/g, "bottom");
  if (/\b(?:center|centre|middle)\b/.test(t) && !/\b(?:top|bottom)\b/.test(t)) return "center";
  const v = /\b(top|bottom)\b/.exec(t)?.[1];
  const h = /\b(left|right)\b/.exec(t)?.[1];
  return v && h ? `${v}-${h}` : null;
}

const SITES = [
  [/^you ?tube$/, "https://www.youtube.com"],
  [/^wikipedia$/, "https://en.wikipedia.org"],
  [/^git ?hub$/, "https://github.com"],
  [/^google$/, "https://www.google.com"],
  [/^(?:twitter|x)$/, "https://x.com"],
  [/^reddit$/, "https://www.reddit.com"],
  [/^hacker ?news$/, "https://news.ycombinator.com"],
  [/^stack ?overflow$/, "https://stackoverflow.com"],
  [/^linkedin$/, "https://www.linkedin.com"],
  [/^amazon$/, "https://www.amazon.com"],
  [/^netflix$/, "https://www.netflix.com"],
  [/^npm$/, "https://www.npmjs.com"],
  [/^solana$/, "https://solana.com"],
  [/^(?:bbc|bbc news)$/, "https://www.bbc.com"],
];

export const FILE_EXT = /\.(?:md|txt|js|jsx|ts|tsx|json|pdf|png|jpe?g|gif|py|css|html?|csv|zip|docx?|xlsx?|pptx?|mp3|mp4|mov|svg|sh)$/i;

export const siteUrl = (name) => SITES.find(([re]) => re.test(String(name).trim().toLowerCase()))?.[1] ?? null;

const parseWhich = (t) => {
  if (/\b(?:latest|newest|most recent|recent|last)\b/i.test(t)) return "latest";
  if (/\b(?:second|2nd)\b/i.test(t)) return "2";
  if (/\b(?:third|3rd)\b/i.test(t)) return "3";
  return "first";
};

/**
 * @param {string} seg  one cleaned segment of the command
 * @param {{snap?:object|null, mentionedApps:(s:string)=>string[], appName:(k:string)=>string, pickBrowser:()=>string}} h
 */
export function planDesktopSegment(seg, h) {
  const low = seg.toLowerCase();
  const snap = h.snap ?? null;
  let m;
  const hit = (actions, phrase, extra = {}) => ({ actions, phrase, ...extra });
  const kindOf = (s) => tidy(s.replace(/^(?:the|my|a|an)\s+/i, "")).toLowerCase();

  // ----- wallpaper -----
  if (/^(?:list|show|what)\b.*\bwallpapers?\b/.test(low) && !/\b(?:change|set|make)\b/.test(low)) {
    return hit([inv("desktop", "list_wallpapers")], "listing the wallpapers", { followup: { kind: "answer" } });
  }
  if (
    /^(?:(?:change|switch|set|give me|go to|show)\s+(?:to\s+)?)?(?:the\s+|my\s+)?(?:next|another|a different|a new|different|new|random)\s+(?:desktop\s+)?(?:wallpaper|background)$/.test(low) ||
    /^(?:next|shuffle|cycle)\s+(?:the\s+)?(?:wallpaper|background)s?$/.test(low) ||
    /^(?:change|switch|shuffle|cycle|update|swap)\s+(?:the\s+|my\s+)?(?:desktop\s+)?(?:wallpaper|background)$/.test(low)
  ) {
    return hit([inv("desktop", "set_wallpaper", { name: "next" })], "switching to the next wallpaper");
  }
  if (
    (m = /^(?:change|switch|set|update|swap|put|make)\s+(?:my\s+|the\s+|this\s+)?(?:desktop\s+)?(?:wallpaper|background)(?:\s+(?:image|picture|photo))?\s+(?:to|as|into|with|look(?:ing)?(?:\s+like)?|be)?\s*(.+)$/i.exec(seg)) ||
    (m = /^(?:use|set|put|apply)\s+(?:an?\s+|the\s+)?(.+?)\s+(?:as\s+)?(?:the\s+|my\s+)?(?:desktop\s+)?(?:wallpaper|background)$/i.exec(seg)) ||
    (m = /^(?:i want|i'd like|give me)\s+(?:an?\s+|the\s+)?(.+?)\s+(?:desktop\s+)?(?:wallpaper|background)$/i.exec(seg))
  ) {
    const name = tidy(m[1].replace(/^(?:an?|the|some)\s+/i, "").replace(/\s+(?:one|please|wallpaper|background|image|picture)$/i, "").replace(/\s+one$/i, ""));
    if (name) return hit([inv("desktop", "set_wallpaper", { name })], `setting the wallpaper to ${name}`);
  }

  // ----- widgets -----
  if ((m = /^(?:move|put|place|drag|shift|position|send|relocate|set)\s+(.+?)\s+widget\s+(?:to|in|on|at|into|over to)\s+(?:the\s+|a\s+)?(.+)$/i.exec(seg))) {
    const position = parsePosition(m[2]);
    const kind = kindOf(m[1]);
    if (position && kind) return hit([inv("desktop", "widget_move", { kind, position })], `moving the ${kind} widget to the ${position.replace("-", " ")}`);
  }
  if ((m = /^(?:remove|delete|hide|get rid of|take (?:away|off)|dismiss|turn off|disable|close)\s+(.+?)\s+widget(?:s)?(?:\s+(?:from|on|off)\s+(?:the\s+|my\s+)?(?:desktop|screen))?$/i.exec(seg))) {
    const kind = kindOf(m[1]);
    if (kind) return hit([inv("desktop", "widget_remove", { kind })], `removing the ${kind} widget`);
  }
  if ((m = /^(?:add|show|put|place|create|bring up|turn on|enable|give me|i want)\s+(?:me\s+)?(.+?)\s+widget(?:s)?(?:\s+(?:to|on|onto|in)\s+(?:the\s+|my\s+)?(?:desktop|screen|home screen))?$/i.exec(seg))) {
    const kind = kindOf(m[1]);
    if (kind) return hit([inv("desktop", "widget_add", { kind })], `adding the ${kind} widget`);
  }
  if (/^(?:what|which|list|show)\b.*\bwidgets\b/.test(low)) {
    return hit([inv("desktop", "widget_list")], "listing the widgets", { followup: { kind: "answer" } });
  }

  // ----- dock -----
  const appForDock = (raw) => {
    const t = tidy(raw.replace(/^(?:the|my|an?)\s+/i, "").replace(/\s+(?:app|icon)$/i, ""));
    const key = h.mentionedApps(t)[0];
    return key ? h.appName(key) : capital(t);
  };
  if ((m = /^(?:add|put|pin|keep|place|stick)\s+(.+?)\s+(?:to|on|in|into|onto)\s+(?:the\s+|my\s+)?dock$/i.exec(seg))) {
    const app = appForDock(m[1]);
    if (app) return hit([inv("desktop", "dock_add", { app })], `adding ${app} to the dock`);
  }
  if ((m = /^(?:remove|take|delete|unpin|get rid of|drop|clear)\s+(.+?)\s+(?:from|off|out of|off of)\s+(?:the\s+|my\s+)?dock$/i.exec(seg))) {
    const app = appForDock(m[1]);
    if (app) return hit([inv("desktop", "dock_remove", { app })], `removing ${app} from the dock`);
  }
  if (/\bdock\b/.test(low) && /\b(?:hide|auto-?hide|autohide|disappear|get out of the way|slide away)\b/.test(low) && !/\b(?:stop|don't|do not|disable|turn off|never|no longer)\b/.test(low)) {
    return hit([inv("desktop", "dock_autohide", { hidden: true })], "hiding the dock");
  }
  if (/\bdock\b/.test(low) && (/\b(?:show|unhide|bring back|always|keep)\b/.test(low) || /\b(?:stop|disable|turn off|don't|do not)\b.*\b(?:hid|hide|hiding|auto-?hid\w*|autohide)\b/.test(low))) {
    return hit([inv("desktop", "dock_autohide", { hidden: false })], "showing the dock");
  }

  // ----- desktop files -----
  if ((m = /^(?:create|make|add|new|build)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:new\s+)?(?:folder|directory)(?:\s+(?:called|named|name|titled|with the name)?\s*(.+?))?(?:\s+(?:on|in|at|to)\s+(?:the\s+|my\s+)?(?:desktop|screen))?$/i.exec(seg))) {
    const name = tidy(unquote(m[1] ?? ""));
    if (name) return hit([inv("desktop", "create_folder", { name: capital(name) })], `creating the folder ${capital(name)}`);
  }
  if ((m = /^(?:create|make|add|new)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:new\s+)?(?:text\s+|empty\s+|blank\s+)?file(?:\s+(?:called|named|name|titled))?\s+(.+?)(?:\s+(?:with|containing|that says|saying)\s+(.+))?$/i.exec(seg))) {
    let name = tidy(unquote(m[1])).replace(/\s+(?:on|in|at|to)\s+(?:the\s+|my\s+)?(?:desktop|screen)$/i, "");
    name = name.replace(/\s+dot\s+(\w{1,5})$/i, ".$1").replace(/\s+/g, "-");
    if (name) {
      if (!/\.\w{1,5}$/.test(name)) name += ".txt";
      const text = m[2] ? tidy(unquote(m[2])) : "";
      return hit([inv("desktop", "create_file", { name, ...(text ? { text } : {}) })], `creating the file ${name}`);
    }
  }
  if ((m = /^rename\s+(?:the\s+)?(?:file\s+|folder\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i.exec(seg)) && !h.mentionedApps(m[1]).length) {
    const from = tidy(unquote(m[1]));
    const to = tidy(unquote(m[2]));
    if (from && to) return hit([inv("desktop", "rename_item", { from, to })], `renaming ${from} to ${to}`);
  }
  if ((m = /^(?:delete|trash|throw away|move to (?:the )?trash|get rid of)\s+(?:the\s+)?(?:file\s+|folder\s+)?(.+?)(?:\s+(?:from|on)\s+(?:the\s+|my\s+)?desktop)?(?:\s+(?:to|in|into)\s+(?:the\s+)?trash)?$/i.exec(seg)) &&
    (/\b(?:desktop|trash|folder|file)\b/.test(low)) && !/\b(?:widget|dock)\b/.test(low) && !h.mentionedApps(m[1]).length) {
    const name = tidy(unquote(m[1]).replace(/^(?:the\s+)?(?:file|folder)\s+/i, ""));
    if (name) return hit([inv("desktop", "delete_item", { name })], `moving ${name} to the Trash`);
  }

  // ----- desktop / launchpad / spotlight / lock / screenshot -----
  if (/^(?:show|go to|reveal|display|take me to|get to|switch to|bring up)\s+(?:me\s+)?(?:the\s+|my\s+)?desktop$/.test(low) || /^(?:clear|empty)\s+(?:the\s+|my\s+)?(?:desktop|screen)$/.test(low) || /^(?:hide|minimi[sz]e)\s+(?:all|every)\s+(?:the\s+)?windows$/.test(low)) {
    return hit([inv("desktop", "show_desktop")], "showing the desktop");
  }
  if (/^(?:close|exit|dismiss|leave|hide)\s+(?:the\s+)?launchpad$/.test(low)) {
    return hit([inv("desktop", "close_launchpad")], "closing Launchpad");
  }
  if (/^(?:open|show|launch|bring up|pull up|go to|start|display)\s+(?:me\s+)?(?:the\s+)?launchpad$/.test(low) || /^launchpad$/.test(low) || /^(?:show|open|see)\s+(?:me\s+)?(?:all\s+)?(?:of\s+)?(?:my\s+)?(?:all\s+)?apps$/.test(low)) {
    return hit([inv("desktop", "open_launchpad")], "opening Launchpad");
  }
  if ((m = /^(?:(?:open|use|launch|bring up)\s+)?spotlight(?:\s+(?:and\s+)?(?:search|look|find|type)(?:\s+for)?)?\s*(.*)$/i.exec(seg)) || (m = /^search\s+(?:my\s+|the\s+)?(?:mac|computer|desktop|files|laptop)(?:\s+for)?\s+(.+)$/i.exec(seg))) {
    const query = tidy(unquote(m[1] ?? ""));
    return hit([inv("desktop", "spotlight", { query })], query ? `searching Spotlight for ${query}` : "opening Spotlight", { followup: { kind: "answer" } });
  }
  if (/^lock(?:\s+(?:the\s+|my\s+)?(?:screen|computer|mac|desktop|laptop|it|up))?$/.test(low) || /^(?:put|send)\s+(?:the\s+|my\s+)?(?:computer|mac|screen)\s+(?:to\s+)?(?:lock|sleep)$/.test(low)) {
    return hit([inv("desktop", "lock_screen")], "locking the screen");
  }
  if (/^(?:take|grab|capture|snap|get|make|do)\s+(?:me\s+)?(?:a\s+|the\s+)?(?:quick\s+)?(?:screenshot|screen ?shot|screen capture|screen grab|picture of (?:the|my) screen)(?:\s+(?:of (?:the|my) (?:screen|desktop)|please|now))?$/.test(low) || /^(?:screenshot|screen ?shot)$/.test(low)) {
    return hit([inv("desktop", "screenshot")], "taking a screenshot");
  }

  // ----- brightness / system volume -----
  if (/\b(?:brightness|brighter|dimmer|dim|brighten)\b/.test(low)) {
    const abs = /\b(?:to|at)\b|\bset\b|\bbrightness\s+\d/.test(low) ? parseLevel(low) : /\b(?:max(?:imum)?|full|lowest|minimum|min|half)\b/.test(low) ? parseLevel(low) : null;
    if (abs !== null) return hit([inv("desktop", "set_brightness", { level: abs })], `setting the brightness to ${abs}`);
    const cur = Number.isFinite(snap?.settings?.brightness) ? snap.settings.brightness : 70;
    const up = /\b(?:up|raise|increase|higher|brighter|brighten|more|boost)\b/.test(low) && !/\b(?:lower|dim|decrease|reduce|down|less)\b/.test(low);
    const down = /\b(?:lower|dim|dimmer|decrease|reduce|down|less|darker|turn down)\b/.test(low);
    if (up || down) {
      const level = Math.max(0, Math.min(100, cur + (up ? 25 : -25)));
      return hit([inv("desktop", "set_brightness", { level })], up ? "raising the brightness" : "lowering the brightness");
    }
  }
  if (/\b(?:system|master|computer|mac|overall|device|laptop)\s+(?:volume|sound)\b|\b(?:volume|sound)\b.*\b(?:of|on)\s+(?:the\s+|my\s+)?(?:system|computer|mac|laptop)\b/.test(low)) {
    const abs = parseLevel(low);
    if (abs !== null) return hit([inv("desktop", "set_system_volume", { level: abs })], `setting the system volume to ${abs}`);
    const up = /\b(?:up|raise|increase|higher|louder)\b/.test(low);
    const down = /\b(?:down|lower|decrease|reduce|quieter|softer)\b/.test(low);
    if (up || down) {
      const cur = Number.isFinite(snap?.settings?.volume) ? snap.settings.volume : 50;
      const level = Math.max(0, Math.min(100, cur + (up ? 20 : -20)));
      return hit([inv("desktop", "set_system_volume", { level })], up ? "turning the system volume up" : "turning the system volume down");
    }
    if (/\bmute\b/.test(low)) return hit([inv("desktop", "set_system_volume", { level: 0 })], "muting the system volume");
  }

  // ----- open a site by name or address -----
  if ((m = /^(?:open|go to|visit|launch|load|pull up|bring up|take me to|navigate to|browse to)\s+(?:the\s+)?(?:website\s+|site\s+)?(.+?)(?:\s+(?:website|site|page|homepage))?$/i.exec(seg))) {
    const target = tidy(unquote(m[1]));
    if (!h.mentionedApps(target).length) {
      const known = siteUrl(target);
      const domain = FILE_EXT.test(target) ? null : /^((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?)$/i.exec(target)?.[1];
      const url = known ?? domain;
      if (url) return hit([inv("browser", "open_url", { url })], `opening ${target}`, { needs: [h.pickBrowser()] });
    }
  }

  // ----- search the web (inside a longer command) -----
  if ((m = /^(?:search|google|look up|look for|find|research)\s+(?:the\s+)?(?:web|internet|online|google|bing)?\s*(?:for\s+|up\s+)?(.+)$/i.exec(seg)) && /^(?:search|google|look up)\b/i.test(seg)) {
    let q = m[1];
    let opened = false;
    let which = "first";
    let read = false;
    const tail = /^(.*?)[\s,]+(?:and\s+)?(?:then\s+)?(?:open|click|go to|show(?: me)?|pull up|read)\s+(?:me\s+)?(?:the\s+|a\s+)?(.*)$/i.exec(q);
    if (tail) {
      q = tail[1];
      opened = true;
      which = parseWhich(tail[2]);
      read = /\b(?:summari[sz]e|summary|read|tell me|explain)\b/i.test(tail[2]);
    }
    q = tidy(q.replace(/^(?:the web|the internet|online|google|bing)\s+(?:for\s+)?/i, "").replace(/\s+(?:for me|please|online|on the web|on google|in (?:chrome|safari|the browser))$/i, ""));
    if (q) {
      const papers = /\b(?:papers?|arxiv|journal|studies)\b/i.test(q);
      const searchBrowser = /\bsafari\b/i.test(seg) || (h.openNow?.has("safari") && !h.openNow?.has("chrome")) ? "safari" : "chrome";
      return hit(
        [inv("browser", "search", { query: q, source: papers ? "papers" : "web" }), ...(opened ? [inv("browser", "open_result", { which })] : []), ...(read ? [inv("browser", "read_page")] : [])],
        `searching for ${q}${opened ? " and opening the result" : ""}`,
        { needs: [searchBrowser], followup: { kind: "search_report", opened, ...(read ? { read: true } : {}) } },
      );
    }
  }

  return null;
}
