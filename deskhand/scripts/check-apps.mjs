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
  assert.ok(text.includes("Claude Code (simulated for Deskhand v1)"));
});
check("prompt shows user and relative cwd", () => {
  assert.equal(stripAnsi(promptText(createSession())), "guest@deskhand ~/orbit-todo % ");
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

console.log(`check-apps: ${passed} checks passed`);
