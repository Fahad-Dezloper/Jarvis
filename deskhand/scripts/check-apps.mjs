// Run: npm run check:apps
// Known-answer checks for the pure app modules (terminal interpreter, browser
// pages, music playlists, settings keys, finder search). No browser needed.
import assert from "node:assert/strict";
import {
  BANNER_TITLE,
  createSession,
  eventsToText,
  interpret,
  looksLikeRequest,
  promptText,
  resolvePath,
  stripAnsi,
  welcomeEvents,
} from "../src/module/desktop/apps/terminal/interpreter.js";
import {
  ARTIFACT_URL,
  GITHUB_URL,
  HN_URL,
  START_URL,
  STORIES,
  findMockPage,
  isCurrentPageRef,
  pickLink,
  resolveTarget,
} from "../src/module/desktop/apps/safari/data/pages.js";
import { getLastCopied, setLastCopied } from "../src/module/desktop/apps/safari/clipboard.js";
import {
  PLAYLISTS,
  clampVolume,
  compact,
  matchPlaylist,
  matchTrack,
} from "../src/module/desktop/apps/music/data/playlists.js";
import {
  normalizeSettingKey,
  parseBoolean,
  parseTheme,
} from "../src/module/desktop/apps/settings/data/settingsKeys.js";
import { findFinderItem } from "../src/module/desktop/apps/finder/finderSearch.js";
import { readFinderFile } from "../src/module/desktop/apps/finder/finderFiles.js";
import { compute } from "../src/module/desktop/apps/calculator/calcCore.js";
import { parseWhen, upcomingEvents, formatEventLine } from "../src/module/desktop/apps/calendar/calendarCore.js";
import {
  buildResults,
  formatResultsData,
  isParadigmQuery,
  parseArxivAtom,
  parseInternalUrl,
  searchUrl,
  selectResult,
} from "../src/module/desktop/apps/chrome/searchCore.js";
import { PARADIGM_RESEARCH, PARADIGM_SNAPSHOT_LABEL } from "../src/module/desktop/apps/chrome/data/paradigmResearch.js";
import { WEB_INDEX } from "../src/module/desktop/apps/chrome/data/webIndex.js";
import { PROJECT_FILES, findProjectFile, projectDigest } from "../src/module/desktop/apps/shared/orbitTodoProject.js";
import { describeWeather, fallbackWeather } from "../src/module/desktop/apps/weather/weatherCore.js";
import { isValidRecipient, resolveRecipient } from "../src/module/desktop/apps/mail/mailCore.js";

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}`);
    throw err;
  }
};
const run = (cmd, session = createSession()) => {
  const r = interpret(cmd, session, new Date("2026-10-26T09:00:00Z"));
  return { ...r, text: eventsToText(r.events), session };
};

// ---------------------------------------------------------------- terminal
check("welcome banner names the simulation", () => {
  const text = eventsToText(welcomeEvents());
  assert.ok(text.includes(BANNER_TITLE));
  assert.ok(text.includes("Claude Code (simulated for Orry v1)"));
});
check("prompt shows user and relative cwd", () => {
  assert.equal(stripAnsi(promptText(createSession())), "guest@orry ~/orbit-todo % ");
});
check("pwd / whoami / date / echo", () => {
  assert.equal(run("pwd").text, "/home/guest/orbit-todo");
  assert.equal(run("whoami").text, "guest");
  assert.ok(run("date").text.includes("2026"));
  assert.equal(run('echo "hello world"').text, "hello world");
});
check("ls lists the project, hides dotfiles, -a shows them", () => {
  const out = run("ls").text;
  for (const f of ["README.md", "package.json", "src", "tests"]) assert.ok(out.includes(f), f);
  assert.ok(!out.includes(".gitignore"));
  assert.ok(run("ls -a").text.includes(".gitignore"));
  assert.ok(run("ls src").text.includes("App.jsx"));
  assert.ok(run("ls nope").text.includes("No such file"));
});
check("cat prints files and errors on missing", () => {
  const pkg = run("cat package.json").text;
  assert.ok(pkg.includes('"name": "orbit-todo"'));
  assert.ok(pkg.includes('"dev": "vite"'));
  assert.ok(run("cat README.md").text.startsWith("# orbit-todo"));
  assert.ok(run("cat src/App.jsx").text.includes("export default function App"));
  assert.ok(run("cat missing.txt").text.includes("No such file or directory"));
});
check("cd changes cwd and affects ls/pwd", () => {
  const s = createSession();
  interpret("cd src", s);
  assert.equal(run("pwd", s).text, "/home/guest/orbit-todo/src");
  assert.ok(run("ls", s).text.includes("utils"));
  interpret("cd ..", s);
  assert.equal(s.cwd, "/home/guest/orbit-todo");
  interpret("cd", s);
  assert.equal(s.cwd, "/home/guest");
  assert.equal(resolvePath("/home/guest", "~/orbit-todo/../orbit-todo/src"), "/home/guest/orbit-todo/src");
});
check("git status and log", () => {
  assert.ok(run("git status").text.includes("On branch main"));
  const log = run("git log --oneline").text.split("\n");
  assert.equal(log.length, 5);
  assert.ok(/^[0-9a-f]{7} /.test(log[0]));
});
check("npm run dev streams and keeps serving", () => {
  const r = run("npm run dev");
  assert.equal(r.serve, true);
  assert.ok(r.text.includes("http://localhost:5173/"));
  assert.ok(r.events.some((e) => e.delay > 0), "streams with delays");
});
check("npm test streams a passing summary", () => {
  const r = run("npm test");
  assert.equal(r.serve, false);
  assert.ok(r.text.includes("Tests") && r.text.includes("10 passed"));
  assert.ok(run("npm run test").text.includes("passed"));
});
check("claude and natural language show plan, tool calls with checkmarks, result", () => {
  for (const cmd of ["claude add a dark mode toggle", "add a dark mode toggle to the app", "fix the date bug"]) {
    const r = run(cmd);
    assert.ok(r.text.includes("Reading files..."), cmd);
    assert.ok(r.text.includes("Plan"), cmd);
    assert.ok(/Read\(/.test(r.text), cmd);
    assert.ok(r.text.includes("✓"), cmd);
    assert.ok(r.text.includes("Done."), cmd);
  }
  assert.ok(run("explain this project").text.includes("orbit-todo is a small React"));
});
check("claude with no args prints the banner; --version works", () => {
  assert.ok(run("claude").text.includes(BANNER_TITLE));
  assert.ok(run("claude --version").text.includes("simulated"));
});
check("help lists commands; clear returns a clear event", () => {
  const h = run("help").text;
  for (const w of ["ls", "git status", "npm run dev", "claude", "clear"]) assert.ok(h.includes(w), w);
  assert.equal(run("clear").events[0].clear, true);
});
check("unknown single word is command-not-found; sentences go to Claude", () => {
  assert.ok(run("frobnicate").text.includes("command not found: frobnicate"));
  assert.equal(looksLikeRequest("frobnicate"), false);
  assert.equal(looksLikeRequest("make the header sticky"), true);
  assert.equal(looksLikeRequest("what does App do?"), true);
  assert.equal(run("").events.length, 0);
});
check("interpreter output is deterministic", () => {
  assert.equal(run("git log").text, run("git log").text);
  assert.equal(run("add tests").text, run("add tests").text);
});

// ---------------------------------------------------------------- browser
check("artifact url is the poker odds page", () => {
  assert.equal(ARTIFACT_URL, "https://claude.ai/public/artifacts/poker-odds-9f2c");
  assert.equal(findMockPage(ARTIFACT_URL).kind, "artifact");
  assert.equal(findMockPage(ARTIFACT_URL.toUpperCase() + "/").id, "poker-odds");
  assert.equal(findMockPage(GITHUB_URL + "#src").id, "github");
  assert.equal(findMockPage("https://example.org/"), null);
});
check("there are 8 hacker news stories, each reachable as a page", () => {
  assert.equal(STORIES.length, 8);
  for (const s of STORIES) assert.ok(findMockPage(s.url), s.url);
});
check("resolveTarget by id, alias, url, label", () => {
  assert.equal(resolveTarget("poker-odds").url, ARTIFACT_URL);
  assert.equal(resolveTarget("hacker news").url, HN_URL);
  assert.equal(resolveTarget("GitHub").url, GITHUB_URL);
  assert.equal(resolveTarget("start page").url, START_URL);
  assert.equal(resolveTarget(ARTIFACT_URL).url, ARTIFACT_URL);
  const links = [
    { label: "Why SQLite is the only database most apps need", url: "https://sqlite-notes.dev/one-database" },
    { label: "Voice interfaces finally feel fast", url: "https://latency.fyi/voice-interfaces" },
  ];
  assert.equal(resolveTarget("the sqlite story", links).url, "https://sqlite-notes.dev/one-database");
  assert.equal(resolveTarget("voice interfaces", links).url, "https://latency.fyi/voice-interfaces");
  assert.equal(resolveTarget("https://unknown.example/x"), null);
  assert.equal(resolveTarget("zzzz qqqq"), null);
});
check("pickLink fuzzy-matches visible labels", () => {
  const links = [
    { label: "Share artifact link", url: ARTIFACT_URL },
    { label: "the discussion on Hacker News", url: HN_URL },
  ];
  assert.equal(pickLink("artifact", links).url, ARTIFACT_URL);
  assert.equal(pickLink("hacker news", links).url, HN_URL);
  assert.equal(pickLink("pizza", links), null);
  assert.ok(isCurrentPageRef("") && isCurrentPageRef("this page") && !isCurrentPageRef("hacker news"));
});
check("module-level last-copied fallback", () => {
  setLastCopied(ARTIFACT_URL);
  assert.equal(getLastCopied(), ARTIFACT_URL);
});

// ------------------------------------------------------------------ music
check("playlists include HiNV Music, Night Drive, Focus with 3 synth tracks", () => {
  const names = PLAYLISTS.map((p) => p.name);
  assert.deepEqual(names, ["HiNV Music", "Night Drive", "Focus"]);
  for (const p of PLAYLISTS) assert.equal(p.synth.length, 3, p.name);
});
check("fuzzy playlist matching is case and space insensitive", () => {
  for (const q of ["HiNV Music", "hinv", "hi nv", "HI NV", "the hinv music playlist", "play hinv playlist", "Hi-NV"]) {
    assert.equal(matchPlaylist(q)?.playlist.id, "hinv", q);
  }
  assert.equal(matchPlaylist("night drive")?.playlist.id, "night-drive");
  assert.equal(matchPlaylist("some focus music")?.playlist.id, "focus");
  assert.equal(matchPlaylist("bohemian rhapsody"), null);
  assert.equal(matchPlaylist("music"), null);
  assert.equal(compact("The HiNV Music playlist"), "hinv");
});
check("track matching by title", () => {
  const tracks = [{ title: "Midnight Static" }, { title: "Paper Lanterns" }];
  assert.equal(matchTrack("paper lanterns", tracks).track.title, "Paper Lanterns");
  assert.equal(matchTrack("midnight", tracks).track.title, "Midnight Static");
  assert.equal(matchTrack("zzz", tracks), null);
});
check("volume clamps to 0..100", () => {
  assert.equal(clampVolume(150), 100);
  assert.equal(clampVolume(-5), 0);
  assert.equal(clampVolume("40"), 40);
  assert.equal(clampVolume("loud"), null);
});

// --------------------------------------------------------------- settings
check("settings keys, booleans and themes", () => {
  assert.equal(normalizeSettingKey("Wi-Fi"), "wifi");
  assert.equal(normalizeSettingKey("focus mode"), "focusMode");
  assert.equal(normalizeSettingKey("night light"), "nightLight");
  assert.equal(normalizeSettingKey("vpn"), "vpn");
  assert.equal(normalizeSettingKey("flux capacitor"), null);
  assert.equal(parseBoolean("on"), true);
  assert.equal(parseBoolean("off"), false);
  assert.equal(parseBoolean(true), true);
  assert.equal(parseBoolean("maybe"), null);
  assert.equal(parseTheme("Dark"), "dark");
  assert.equal(parseTheme("light mode"), "light");
  assert.equal(parseTheme("blue"), null);
});

// ----------------------------------------------------------------- finder
check("finder finds nested files and folders by fuzzy name", () => {
  const roots = [
    { name: "Desktop", kind: "folder", children: [
      { name: "NewTube", kind: "folder", children: [{ name: "NewTube Project.txt", kind: "file" }] },
      { name: "resume.pdf", kind: "file" },
    ] },
    { name: "Trash", kind: "folder", children: [] },
  ];
  assert.equal(findFinderItem("newtube", roots).name, "NewTube");
  assert.equal(findFinderItem("newtube project", roots).name, "NewTube Project.txt");
  assert.equal(findFinderItem("the resume", roots).name, "resume.pdf");
  assert.equal(findFinderItem("open the trash folder", roots).name, "Trash");
  assert.equal(findFinderItem("nothing here", roots), null);
});

// ------------------------------------------------------------- calculator
check("calculator parses operators, precedence, brackets and powers", () => {
  const v = (e) => compute(e).value;
  assert.equal(v("2 + 3 * 4"), 14);
  assert.equal(v("(2 + 3) * 4"), 20);
  assert.equal(v("2 ^ 10"), 1024);
  assert.equal(v("-5 + 2"), -3);
  assert.equal(v("10 / 4"), 2.5);
  assert.equal(compute("0.1 + 0.2").text, "0.3");
  assert.equal(compute("1,000 + 1").text, "1001");
});
check("calculator understands words and percentages", () => {
  assert.equal(compute("18 percent of 2450").text, "441");
  assert.equal(compute("18% of 2450").text, "441");
  assert.equal(compute("what is 15 percent of 80").text, "12");
  assert.equal(compute("12 times 5").text, "60");
  assert.equal(compute("100 plus 25 minus 5").text, "120");
  assert.equal(compute("81 divided by 9").text, "9");
  assert.equal(compute("7 squared").text, "49");
  assert.equal(compute("200 + 10%").text, "220");
  assert.equal(compute("50%").text, "0.5");
  assert.equal(compute("3 x 4").text, "12");
});
check("calculator rejects bad input without evaluating code", () => {
  for (const bad of ["", "1 / 0", "(1 + 2", "2 +", "alert(1)", "process.exit()", "1; 2", "constructor"]) {
    assert.equal(compute(bad).ok, false, bad);
  }
});

// --------------------------------------------------------------- calendar
check("calendar parses day + time phrases", () => {
  const now = new Date(2026, 9, 26, 9, 30); // Monday 26 Oct 2026, 09:30
  assert.deepEqual(parseWhen("tomorrow 3pm", now), { date: "2026-10-27", start: "15:00", end: "16:00", matched: true });
  assert.equal(parseWhen("today at 15:00", now).start, "15:00");
  assert.equal(parseWhen("next monday 10:30am", now).date, "2026-11-02");
  assert.equal(parseWhen("friday at 4pm", now).date, "2026-10-30");
  assert.equal(parseWhen("tomorrow", now).start, "09:00");
  assert.equal(parseWhen("3pm", now).date, "2026-10-26");
  assert.equal(parseWhen("8am", now).date, "2026-10-27");
  assert.equal(parseWhen("2026-12-01 noon", now).start, "12:00");
  assert.equal(parseWhen("in 3 days at 2pm", now).date, "2026-10-29");
});
check("calendar falls back to the next hour", () => {
  const now = new Date(2026, 9, 26, 9, 30);
  const w = parseWhen("sometime soonish", now);
  assert.equal(w.matched, false);
  assert.equal(w.start, "10:00");
  assert.equal(parseWhen("", now).date, "2026-10-26");
  const late = parseWhen("", new Date(2026, 9, 26, 23, 40));
  assert.equal(late.start, "00:00");
});
check("upcoming events are sorted and skip the past", () => {
  const now = new Date(2026, 9, 26, 12, 0);
  const evs = [
    { id: "a", title: "Old", date: "2026-10-25", start: "09:00", end: "10:00" },
    { id: "b", title: "Later", date: "2026-10-27", start: "09:00", end: "10:00" },
    { id: "c", title: "Today pm", date: "2026-10-26", start: "14:00", end: "15:00" },
    { id: "d", title: "Done today", date: "2026-10-26", start: "08:00", end: "09:00" },
  ];
  assert.deepEqual(upcomingEvents(evs, now).map((e) => e.id), ["c", "b"]);
  assert.ok(formatEventLine(evs[2], now).includes("Today pm"));
});

// ------------------------------------------------------------ search/papers
const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2610.01234v1</id>
    <published>2026-10-20T17:59:59Z</published>
    <title>Scaling   Laws
      for Tiny Models</title>
    <summary>  We study &amp; measure scaling.
 Results are surprising.  </summary>
    <author><name>Ada Lovelace</name></author>
    <author><name>Alan Turing</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2609.99999v2</id>
    <published>2026-09-02T10:00:00Z</published>
    <title>An Older Paper</title>
    <summary>Short.</summary>
    <author><name>Grace Hopper</name></author>
  </entry>
</feed>`;
check("arXiv Atom feed parses into results", () => {
  const r = parseArxivAtom(ATOM);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, "Scaling Laws for Tiny Models");
  assert.equal(r[0].date, "2026-10-20");
  assert.deepEqual(r[0].authors, ["Ada Lovelace", "Alan Turing"]);
  assert.equal(r[0].abstract, "We study & measure scaling. Results are surprising.");
  assert.equal(r[0].url, "https://arxiv.org/abs/2610.01234v1");
  assert.equal(r[0].source, "arXiv");
  assert.deepEqual(parseArxivAtom("not xml"), []);
  assert.deepEqual(parseArxivAtom(null), []);
});
check("result selection: latest, first, number, fuzzy title", () => {
  const list = [
    { id: "1", title: "Alpha networks", date: "2026-03-01" },
    { id: "2", title: "Beta Markets", date: "2026-10-22" },
    { id: "3", title: "Gamma proofs", date: "2026-09-30" },
  ];
  assert.equal(selectResult(list, "latest").result.id, "2");
  assert.equal(selectResult(list, "the newest one").result.id, "2");
  assert.equal(selectResult(list, "most recent paper").result.id, "2");
  assert.equal(selectResult(list, "first").result.id, "1");
  assert.equal(selectResult(list, "3").result.id, "3");
  assert.equal(selectResult(list, "the second one").result.id, "2");
  assert.equal(selectResult(list, "gamma").result.id, "3");
  assert.equal(selectResult(list, "zzz nothing"), null);
  assert.equal(selectResult([], "latest"), null);
  assert.equal(selectResult(list, "7"), null);
});
check("papers search: Paradigm curated results come first, marked", () => {
  assert.ok(isParadigmQuery("Paradigm research papers") && !isParadigmQuery("quantum markets"));
  const r = buildResults("Paradigm research papers", "papers", { arxiv: parseArxivAtom(ATOM) });
  assert.equal(r.results[0].source, "Paradigm Research");
  assert.equal(r.results[0].date, "2026-10-22"); // newest curated post
  assert.ok(r.notes.some((n) => n.includes(PARADIGM_SNAPSHOT_LABEL)));
  assert.ok(r.results.every((x) => x.source === "Paradigm Research"), "plain Paradigm query skips arXiv");
  const mixed = buildResults("Paradigm quantum", "papers", { arxiv: parseArxivAtom(ATOM) });
  assert.equal(mixed.results[0].source, "Paradigm Research");
  assert.ok(mixed.results.some((x) => x.source === "arXiv"));
  assert.equal(selectResult(r.results, "latest").result.title, "Muse Spark Open Kernel Challenge");
});
check("papers search offline falls back to the snapshot with a note", () => {
  const r = buildResults("quantum markets", "papers", { arxiv: null });
  assert.equal(r.offline, true);
  assert.ok(r.notes.some((n) => /offline/i.test(n)));
  assert.ok(r.results.some((x) => /quantum/i.test(x.title)));
});
check("results data lines are numbered 'title | date | url'", () => {
  const lines = formatResultsData(buildResults("Paradigm", "papers", {}).results).split("\n");
  assert.ok(/^1\. .+ \| \d{4}-\d{2}-\d{2} \| https:\/\/www\.paradigm\.xyz\/writing\//.test(lines[0]));
  assert.ok(lines.length >= 5);
});
check("web index: about 25 demo pages across topics, queries match", () => {
  assert.ok(WEB_INDEX.length >= 24 && WEB_INDEX.length <= 28);
  for (const t of ["ai", "crypto", "music", "cooking", "cricket", "travel", "programming"]) {
    assert.ok(WEB_INDEX.some((p) => p.topic === t), t);
  }
  assert.ok(WEB_INDEX.every((p) => p.site.endsWith(".example")));
  const r = buildResults("cricket", "web");
  assert.ok(r.results.length >= 3 && r.results.every((x) => x.demo));
  assert.equal(buildResults("zxqv", "web").results.length, 0);
});
check("paradigm index shape: real-looking titles, ISO dates, paradigm.xyz urls, newest first", () => {
  assert.ok(PARADIGM_RESEARCH.length >= 20);
  assert.ok(/^snapshot taken \d{4}-\d{2}-\d{2}$/.test(PARADIGM_SNAPSHOT_LABEL));
  const seen = new Set();
  for (const p of PARADIGM_RESEARCH) {
    assert.ok(p.title.length > 2);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.date), p.date);
    assert.ok(p.url.startsWith("https://www.paradigm.xyz/writing/"), p.url);
    assert.ok(!seen.has(p.url));
    seen.add(p.url);
  }
  const dates = PARADIGM_RESEARCH.map((p) => p.date);
  assert.deepEqual([...dates].sort().reverse(), dates);
});
check("internal urls round-trip", () => {
  assert.deepEqual(parseInternalUrl(searchUrl("a b&c", "papers")), { type: "search", q: "a b&c", source: "papers" });
  assert.equal(parseInternalUrl("https://x.test"), null);
});

// ------------------------------------------------- terminal: orbit-todo project
check("orbit-todo has about 14+ files incl. config, components, api, tests", () => {
  const paths = Object.keys(PROJECT_FILES);
  assert.ok(paths.length >= 14 && paths.length <= 20, String(paths.length));
  for (const f of ["package.json", "README.md", "vite.config.js", "src/App.jsx", "src/main.jsx", "src/store.js", "src/api.js", ".gitignore", "tests/store.test.js"]) {
    assert.ok(f in PROJECT_FILES, f);
  }
  assert.ok(paths.some((p) => p.startsWith("src/components/")));
});
check("cd orbit-todo works from home and from inside the project", () => {
  const s = createSession();
  interpret("cd ~", s);
  assert.equal(s.cwd, "/home/guest");
  interpret("cd orbit-todo", s);
  assert.equal(s.cwd, "/home/guest/orbit-todo");
  interpret("cd orbit-todo", s);
  assert.equal(s.cwd, "/home/guest/orbit-todo");
  assert.ok(run("ls src/components").text.includes("TodoList.jsx"));
  assert.ok(run("cat src/store.js").text.includes("useSyncExternalStore"));
});
check("claude explain/read prints a Reading trace with checkmarks and a consistent summary", () => {
  for (const cmd of ["claude explain this project", "claude read this project", "what is this project about?", "claude read src/store.js"]) {
    const r = run(cmd);
    assert.ok(/Reading package\.json|Reading src\/store\.js/.test(r.text), cmd);
    assert.ok(r.text.includes("✓"), cmd);
    assert.ok(r.events.some((e) => e.delay > 0), cmd);
  }
  const t = run("claude explain this project").text;
  for (const w of ["React", "Vite", "store", "localStorage", "npm run dev", "tests"]) assert.ok(t.includes(w), w);
  assert.ok(t.includes("Reading src/App.jsx") && t.includes("Reading src/api.js"));
  const narrow = run("claude read src/store.js").text;
  assert.ok(narrow.includes("Reading src/store.js") && !narrow.includes("Reading src/api.js"));
});
check("project digest lists files and trims contents under ~6000 chars", () => {
  const d = projectDigest({ maxChars: 4800 });
  assert.ok(d.text.length <= 4800, String(d.text.length));
  assert.ok(d.text.includes("src/store.js") && d.text.includes("--- package.json ---"));
  assert.ok(d.files.length >= 8);
  assert.equal(findProjectFile("App.jsx").path, "src/App.jsx");
  assert.equal(findProjectFile("package").path, "package.json");
  assert.equal(findProjectFile("nope.txt"), null);
});
check("finder.read_file reads Finder text files and project files", () => {
  const roots = [{ name: "Projects", kind: "folder", children: [{ name: "Todo.txt", kind: "file", description: ["Water the plants.", "Reply."] }] }];
  const a = readFinderFile("todo", roots);
  assert.ok(a.ok && a.data.includes("Water the plants."));
  const b = readFinderFile("package.json", roots);
  assert.ok(b.ok && b.data.includes('"name": "orbit-todo"'));
  assert.ok(readFinderFile("src/store.js", roots).ok);
  assert.equal(readFinderFile("missing thing", roots).ok, false);
  assert.equal(readFinderFile("", roots).ok, false);
});

// ------------------------------------------------------------ weather, mail
check("weather helpers describe a reading and give a labelled offline sample", () => {
  const w = fallbackWeather("mumbai");
  assert.equal(w.city, "Mumbai");
  assert.equal(w.offline, true);
  assert.ok(describeWeather(w).includes("offline sample"));
  assert.ok(describeWeather({ city: "Pune", country: "India", condition: "Sunny", tempC: 30, tempF: 86, feelsC: 32, feelsF: 90 }).includes("feels like 32°C"));
});
check("mail recipients resolve contacts and validate addresses", () => {
  assert.equal(resolveRecipient("Priya"), "priya@northwind.example");
  assert.equal(resolveRecipient("a@b.co"), "a@b.co");
  assert.equal(isValidRecipient("a@b.co"), true);
  assert.equal(isValidRecipient("priya"), false);
});

console.log(`check-apps: ${passed} checks passed`);
