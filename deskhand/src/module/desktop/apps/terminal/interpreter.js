// Pure, deterministic terminal interpreter for the simulated "Claude Code" session.
// No framework or alias imports so it can be tested straight from Node.
//
// interpret(line, session, now) returns { events, serve }
//   events: [{ text, delay }]  printed one per line, `delay` ms before each
//           [{ clear: true }]  clears the screen
//   serve:  true when the command leaves a long-running process (dev server)
//           that only Ctrl+C stops.
// The session object ({ cwd }) is mutated by `cd`.

export const HOME = "/home/guest";
export const PROJECT = `${HOME}/orbit-todo`;
export const BANNER_TITLE = "Claude Code (simulated for Orry v1)";

const ESC = "\x1b[";
const paint = (code, s) => `${ESC}${code}m${s}${ESC}0m`;
export const c = {
  bold: (s) => paint("1", s),
  dim: (s) => paint("2", s),
  green: (s) => paint("32", s),
  blue: (s) => paint("1;34", s),
  red: (s) => paint("31", s),
  yellow: (s) => paint("33", s),
  cyan: (s) => paint("36", s),
  gray: (s) => paint("38;2;110;110;120", s),
  orange: (s) => paint("38;2;217;119;87", s),
  boldOrange: (s) => paint("1;38;2;217;119;87", s),
};

// eslint-disable-next-line no-control-regex
export const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, "");

// ---------------------------------------------------------------- filesystem

const PACKAGE_JSON = `{
  "name": "orbit-todo",
  "version": "0.3.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.4.2",
    "vitest": "^1.6.0"
  }
}`;

const README = `# orbit-todo

A tiny todo app: add tasks, tick them off, filter by status.
Built with React and Vite, no backend, tasks live in localStorage.

## Scripts

- npm run dev    start the dev server on http://localhost:5173
- npm test       run the unit tests
- npm run build  production build into dist/`;

const tree = {
  home: {
    guest: {
      "orbit-todo": {
        ".gitignore": "node_modules\ndist\n.env.local\n",
        "package.json": PACKAGE_JSON,
        "README.md": README,
        src: {
          "main.jsx":
            "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n",
          "App.jsx":
            "import { useState } from 'react';\nimport { formatDue } from './utils/format.js';\n\nexport default function App() {\n  const [todos, setTodos] = useState([]);\n  const [text, setText] = useState('');\n\n  const add = () => {\n    if (!text.trim()) return;\n    setTodos([...todos, { id: Date.now(), text, done: false }]);\n    setText('');\n  };\n\n  return (\n    <main className=\"app\">\n      <h1>Orbit Todo</h1>\n      <input value={text} onChange={(e) => setText(e.target.value)} />\n      <button onClick={add}>Add</button>\n      <ul>\n        {todos.map((t) => (\n          <li key={t.id}>{t.text} {formatDue(t.due)}</li>\n        ))}\n      </ul>\n    </main>\n  );\n}\n",
          "styles.css":
            ":root {\n  --bg: #ffffff;\n  --fg: #1c1c1e;\n  --accent: #6c5ce7;\n}\n\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--fg);\n  font-family: system-ui, sans-serif;\n}\n\n.app {\n  max-width: 480px;\n  margin: 4rem auto;\n}\n",
          utils: {
            "format.js":
              "export function formatDue(due) {\n  if (!due) return '';\n  return new Date(due).toLocaleDateString();\n}\n",
          },
        },
        tests: {
          "format.test.js":
            "import { describe, it, expect } from 'vitest';\nimport { formatDue } from '../src/utils/format.js';\n\ndescribe('formatDue', () => {\n  it('returns empty for no date', () => {\n    expect(formatDue()).toBe('');\n  });\n});\n",
        },
      },
    },
  },
};

const isDir = (n) => n !== null && typeof n === "object";

export function createSession() {
  return { cwd: PROJECT };
}

export function resolvePath(cwd, p) {
  let path = p || ".";
  if (path === "~") path = HOME;
  else if (path.startsWith("~/")) path = HOME + path.slice(1);
  const abs = path.startsWith("/") ? path : `${cwd}/${path}`;
  const out = [];
  for (const part of abs.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return "/" + out.join("/");
}

function lookup(absPath) {
  let node = tree;
  for (const part of absPath.split("/").filter(Boolean)) {
    if (!isDir(node) || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

export function displayPath(cwd) {
  if (cwd === HOME) return "~";
  if (cwd.startsWith(HOME + "/")) return "~" + cwd.slice(HOME.length);
  return cwd;
}

export function promptText(session) {
  return `${c.green("guest@orry")} ${c.blue(displayPath(session.cwd))} % `;
}

// ------------------------------------------------------------------- helpers

const ev = (text, delay = 0) => ({ text, delay });

function banner(session) {
  const inner = ` ✻ ${BANNER_TITLE} `;
  const sub = ` /help for commands · cwd: ${displayPath(session.cwd)} `;
  const w = Math.max(inner.length, sub.length) + 1;
  const row = (s) => c.orange("│") + s.padEnd(w, " ") + c.orange("│");
  return [
    ev(c.orange("╭" + "─".repeat(w) + "╮")),
    ev(row(inner).replace("✻", c.boldOrange("✻"))),
    ev(row(sub).replace(sub, c.gray(sub))),
    ev(c.orange("╰" + "─".repeat(w) + "╯")),
  ];
}

export function welcomeEvents(session = createSession()) {
  return [
    ...banner(session),
    ev(c.gray("Type a command, or describe what you want built in plain English.")),
  ];
}

function lsOutput(session, args) {
  const flags = args.filter((a) => a.startsWith("-")).join("");
  const target = args.find((a) => !a.startsWith("-"));
  const abs = resolvePath(session.cwd, target);
  const node = lookup(abs);
  if (node === undefined) {
    return [ev(c.red(`ls: cannot access '${target}': No such file or directory`))];
  }
  if (!isDir(node)) return [ev(target)];
  let names = Object.keys(node).sort((a, b) => a.localeCompare(b));
  if (!flags.includes("a")) names = names.filter((n) => !n.startsWith("."));
  else names = [".", "..", ...names];
  const fmt = (n) => (isDir(node[n]) || n === "." || n === ".." ? c.blue(n) : n);
  if (flags.includes("l")) {
    const rows = names.map((n) => {
      const dir = isDir(node[n]) || n === "." || n === "..";
      const size = dir ? 128 : String(node[n]).length;
      return `${dir ? "drwxr-xr-x" : "-rw-r--r--"}  1 guest  staff  ${String(size).padStart(5)} Oct 26 09:14 ${fmt(n)}`;
    });
    return [ev(`total ${names.length * 8}`), ...rows.map((r) => ev(r))];
  }
  return [ev(names.map(fmt).join("  "))];
}

function catOutput(session, args) {
  const files = args.filter((a) => !a.startsWith("-"));
  if (!files.length) return [];
  const out = [];
  for (const f of files) {
    const node = lookup(resolvePath(session.cwd, f));
    if (node === undefined) out.push(ev(c.red(`cat: ${f}: No such file or directory`)));
    else if (isDir(node)) out.push(ev(c.red(`cat: ${f}: Is a directory`)));
    else for (const line of node.replace(/\n$/, "").split("\n")) out.push(ev(line));
  }
  return out;
}

function echoOutput(args) {
  const text = args
    .join(" ")
    .replace(/^(["'])(.*)\1$/, "$2")
    .replace(/\$HOME/g, HOME)
    .replace(/\$USER/g, "guest");
  return [ev(text)];
}

const GIT_LOG = [
  ["a41f9c2", "Add filter by status"],
  ["7be03d8", "Persist todos to localStorage"],
  ["c19a5e0", "Style the todo list"],
  ["3d8e7b1", "Add basic todo input"],
  ["09fb2a4", "Initial commit from Vite template"],
];

function gitOutput(args) {
  const sub = args[0];
  if (!sub) return [ev("usage: git <command> [<args>]")];
  if (sub === "status") {
    return [
      ev("On branch main"),
      ev("Your branch is up to date with 'origin/main'."),
      ev(""),
      ev("Changes not staged for commit:"),
      ev(c.gray('  (use "git add <file>..." to update what will be committed)')),
      ev(""),
      ev(c.red("\tmodified:   src/App.jsx")),
      ev(c.red("\tmodified:   src/styles.css")),
      ev(""),
      ev("Untracked files:"),
      ev(c.red("\ttests/format.test.js")),
      ev(""),
      ev('no changes added to commit (use "git add" and/or "git commit -a")'),
    ];
  }
  if (sub === "log") {
    if (args.includes("--oneline")) {
      return GIT_LOG.map(([h, m], i) => ev(`${c.yellow(h)}${i === 0 ? c.cyan(" (HEAD -> main, origin/main)") : ""} ${m}`));
    }
    return GIT_LOG.slice(0, 3).flatMap(([h, m]) => [
      ev(c.yellow(`commit ${h}e5f2b9c04d7a1138a6c2f0b7d1a9e3c4`)),
      ev("Author: Guest <guest@orry.local>"),
      ev("Date:   Mon Oct 26 08:41:07 2026 +0000"),
      ev(""),
      ev(`    ${m}`),
      ev(""),
    ]);
  }
  if (sub === "branch") return [ev(`* ${c.green("main")}`), ev("  feature/filters")];
  if (sub === "diff") {
    return [
      ev(c.bold("diff --git a/src/styles.css b/src/styles.css")),
      ev(c.cyan("@@ -1,5 +1,6 @@")),
      ev(" :root {"),
      ev(c.green("+  --muted: #8e8e93;")),
      ev("   --bg: #ffffff;"),
    ];
  }
  return [ev(c.gray(`git ${args.join(" ")}: done (simulated)`))];
}

function devServer() {
  return [
    ev(""),
    ev("> orbit-todo@0.3.1 dev", 120),
    ev("> vite", 40),
    ev(""),
    ev(`  ${c.green(c.bold("VITE"))} ${c.green("v5.4.2")}  ready in ${c.bold("312")} ms`, 650),
    ev(""),
    ev(`  ${c.green("➜")}  ${c.bold("Local")}:   ${c.cyan("http://localhost:5173/")}`, 80),
    ev(`  ${c.green("➜")}  ${c.bold("Network")}: ${c.gray("use --host to expose")}`, 60),
    ev(`  ${c.green("➜")}  ${c.gray("press h + enter to show help")}`, 60),
  ];
}

function testRun() {
  return [
    ev(""),
    ev("> orbit-todo@0.3.1 test", 100),
    ev("> vitest run", 40),
    ev(""),
    ev(` ${c.cyan(c.bold("RUN"))}  ${c.cyan("v1.6.0")} ${c.gray("~/orbit-todo")}`, 500),
    ev(""),
    ev(` ${c.green("✓")} tests/format.test.js ${c.gray("(4 tests)")} 4ms`, 450),
    ev(` ${c.green("✓")} tests/todo.test.js ${c.gray("(6 tests)")} 9ms`, 350),
    ev(""),
    ev(` ${c.bold("Test Files")}  ${c.green("2 passed")} (2)`, 250),
    ev(`      ${c.bold("Tests")}  ${c.green("10 passed")} (10)`),
    ev(`   ${c.bold("Duration")}  1.02s`),
  ];
}

function npmOutput(args) {
  const sub = args[0];
  if (sub === "run" && args[1] === "dev") return { events: devServer(), serve: true };
  if (sub === "run" && args[1] === "test") return { events: testRun() };
  if (sub === "test" || sub === "t") return { events: testRun() };
  if (sub === "start") return { events: devServer(), serve: true };
  if (sub === "run" && args[1] === "build") {
    return {
      events: [
        ev(""),
        ev("> orbit-todo@0.3.1 build", 100),
        ev("> vite build", 40),
        ev(""),
        ev(c.cyan("vite v5.4.2 building for production..."), 300),
        ev(`${c.green("✓")} 34 modules transformed.`, 700),
        ev(`dist/index.html                  0.46 kB ${c.gray("│ gzip:  0.30 kB")}`, 150),
        ev(`dist/assets/index-Bq3x9.js     143.8 kB ${c.gray("│ gzip: 46.2 kB")}`, 100),
        ev(`${c.green("✓ built in 1.31s")}`, 150),
      ],
    };
  }
  if (sub === "install" || sub === "i" || sub === "ci") {
    return {
      events: [
        ev(""),
        ev(c.gray("added 214 packages, and audited 215 packages in 4s"), 900),
        ev(c.gray("found 0 vulnerabilities"), 120),
      ],
    };
  }
  if (sub === "run" || !sub) {
    return {
      events: [
        ev("Scripts available in orbit-todo@0.3.1:"),
        ev("  npm run dev"),
        ev("  npm run build"),
        ev("  npm test"),
      ],
    };
  }
  return { events: [ev(c.red(`npm error Unknown command: "${sub}"`))] };
}

const HELP = [
  ["help", "show this help"],
  ["ls [-la] [dir]", "list files"],
  ["pwd / cd <dir>", "where am I / change directory"],
  ["cat <file>", "print a file (try package.json, README.md)"],
  ["git status | git log --oneline", "inspect the repo"],
  ["npm run dev | npm test", "start the dev server / run tests"],
  ["claude <request>", "ask Claude Code (simulated) to do something"],
  ["clear", "clear the screen"],
];

function helpOutput() {
  return [
    ev(c.boldOrange(`${BANNER_TITLE}`)),
    ev(c.gray("Commands run against a small fake project in ~/orbit-todo.")),
    ev(""),
    ...HELP.map(([cmd, desc]) => ev(`  ${c.green(cmd.padEnd(32))}${c.gray(desc)}`)),
    ev(""),
    ev(c.gray("Anything else you type is treated as a request to Claude Code.")),
  ];
}

// ------------------------------------------------------ Claude Code look-alike

const VERBS =
  /^(add|fix|create|make|build|write|implement|refactor|update|change|rename|remove|delete|explain|show|find|summari[sz]e|review|improve|optimi[sz]e|debug|generate|set|convert|migrate|document|test|help|can|could|please|what|how|why|where|who|tell)\b/i;

export function looksLikeRequest(line) {
  const words = line.trim().split(/\s+/);
  if (words.length >= 3) return true;
  if (/[?]$/.test(line)) return true;
  return words.length === 2 && VERBS.test(words[0]);
}

function classify(req) {
  const r = req.toLowerCase();
  if (/(explain|what|how|why|summari|overview|understand|walk me|tell me|\?)/.test(r)) return "explain";
  if (/(test|spec|coverage)/.test(r)) return "tests";
  if (/(fix|bug|error|crash|broken|fails?)/.test(r)) return "bugfix";
  if (/(style|css|dark|theme|colou?r|button|layout|ui|design|toggle|responsive)/.test(r)) return "ui";
  return "feature";
}

const TOOL = (name, arg) => `${c.green("●")} ${c.bold(name)}${c.gray("(")}${arg}${c.gray(")")}`;
const RESULT = (text) => `  ${c.gray("⎿")}  ${text}`;

function claudeResponse(request) {
  const kind = classify(request);
  const ask = request.trim().replace(/\s+/g, " ");
  const evs = [
    ev(""),
    ev(`${c.boldOrange(">")} ${ask}`),
    ev(""),
    ev(`${c.orange("✻")} ${c.gray("Reading files...")}`, 450),
  ];
  const push = (text, delay = 400) => evs.push(ev(text, delay));

  const reads = ["package.json", "src/App.jsx"];
  if (kind === "ui") reads.push("src/styles.css");
  if (kind === "tests" || kind === "bugfix") reads.push("src/utils/format.js");
  if (kind === "explain") reads.splice(0, reads.length, "README.md", "package.json", "src/App.jsx");

  for (const f of reads) {
    push(`${TOOL("Read", f)}`, 380);
    push(RESULT(`${c.green("✓")} Read ${lineCount(f)} lines`), 160);
  }
  push("");

  if (kind === "explain") {
    push(`${c.green("●")} orbit-todo is a small React + Vite todo app.`, 500);
    push(`  ${c.gray("-")} State lives in ${c.cyan("src/App.jsx")} (an array of todos and an input).`, 120);
    push(`  ${c.gray("-")} Date formatting sits in ${c.cyan("src/utils/format.js")}.`, 120);
    push(`  ${c.gray("-")} Run it with ${c.cyan("npm run dev")}, test with ${c.cyan("npm test")}.`, 120);
    return evs;
  }

  const plan = {
    tests: ["Add cases for formatDue edge inputs", "Run the suite to confirm they pass"],
    bugfix: ["Find the failing code path", "Patch it and guard the edge case", "Re-run tests"],
    ui: ["Add the needed CSS variables", "Wire the change into App.jsx", "Check it in the dev server"],
    feature: ["Extend the state in App.jsx", "Update the markup and styles", "Run tests"],
  }[kind];
  push(`${c.orange("✻")} ${c.bold("Plan")}`, 300);
  plan.forEach((p, i) => push(`  ${c.gray(`${i + 1}.`)} ${p}`, 140));
  push("");

  const edits = {
    tests: [["Write", "tests/format.test.js", "Wrote 14 lines"]],
    bugfix: [["Update", "src/utils/format.js", "Updated with 3 additions and 1 removal"]],
    ui: [
      ["Update", "src/styles.css", "Updated with 9 additions"],
      ["Update", "src/App.jsx", "Updated with 6 additions and 1 removal"],
    ],
    feature: [
      ["Update", "src/App.jsx", "Updated with 12 additions and 2 removals"],
      ["Update", "src/styles.css", "Updated with 4 additions"],
    ],
  }[kind];
  for (const [tool, file, res] of edits) {
    push(TOOL(tool, file), 450);
    push(RESULT(`${c.green("✓")} ${res}`), 200);
  }
  push(TOOL("Bash", "npm test"), 450);
  push(RESULT(`${c.green("✓")} 10 passed (10)`), 650);
  push("");
  push(`${c.green("✓")} ${c.bold("Done.")} ${summaryFor(kind)}`, 300);
  push(c.gray("  (simulated: no files were actually changed)"), 80);
  return evs;
}

function lineCount(f) {
  const node = lookup(`${PROJECT}/${f}`);
  return typeof node === "string" ? node.split("\n").length : 0;
}

function summaryFor(kind) {
  return {
    tests: "Added tests for the date formatter; all 10 tests pass.",
    bugfix: "Guarded the empty-date path; the suite is green.",
    ui: "Applied the change in App.jsx and styles.css; tests still pass.",
    feature: "Implemented it in App.jsx with matching styles; tests pass.",
  }[kind];
}

// ----------------------------------------------------------------- dispatcher

export function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function interpret(line, session = createSession(), now = new Date()) {
  const raw = String(line ?? "").trim();
  if (!raw) return { events: [], serve: false };
  const parts = raw.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const rest = parts.slice(1);
  const toks = tokenize(raw).slice(1);

  switch (cmd) {
    case "help":
    case "?":
      return { events: helpOutput(), serve: false };
    case "clear":
    case "cls":
      return { events: [{ clear: true, text: "", delay: 0 }], serve: false };
    case "pwd":
      return { events: [ev(session.cwd)], serve: false };
    case "whoami":
      return { events: [ev("guest")], serve: false };
    case "date":
      return { events: [ev(now.toString())], serve: false };
    case "echo":
      return { events: echoOutput(rest), serve: false };
    case "ls":
    case "ll":
      return { events: lsOutput(session, cmd === "ll" ? ["-l", ...toks] : toks), serve: false };
    case "cat":
      return { events: catOutput(session, toks), serve: false };
    case "cd": {
      const target = resolvePath(session.cwd, toks[0] || "~");
      const node = lookup(target);
      if (node === undefined) return { events: [ev(c.red(`cd: no such file or directory: ${toks[0]}`))], serve: false };
      if (!isDir(node)) return { events: [ev(c.red(`cd: not a directory: ${toks[0]}`))], serve: false };
      session.cwd = target;
      return { events: [], serve: false };
    }
    case "git":
      return { events: gitOutput(toks), serve: false };
    case "npm":
    case "pnpm":
    case "yarn": {
      const r = npmOutput(toks.length ? toks : []);
      return { events: r.events, serve: !!r.serve };
    }
    case "node":
      if (toks[0] === "-v" || toks[0] === "--version") return { events: [ev("v20.17.0")], serve: false };
      return { events: [ev(c.gray("node: running scripts is not available in this simulation"))], serve: false };
    case "sudo":
      return { events: [ev(c.red("guest is not in the sudoers file. This incident will be reported."))], serve: false };
    case "claude": {
      const arg = rest.join(" ").trim();
      if (!arg) return { events: [...banner(session), ev(c.gray("Describe a task and press Enter."))], serve: false };
      if (arg === "--version" || arg === "-v") return { events: [ev(`1.0.0 (${BANNER_TITLE})`)], serve: false };
      if (arg === "--help" || arg === "-h" || arg === "/help") return { events: helpOutput(), serve: false };
      const request = arg.replace(/^(-p|--print)\s+/, "").replace(/^(["'])(.*)\1$/, "$2");
      return { events: claudeResponse(request), serve: false };
    }
    default:
      if (looksLikeRequest(raw)) return { events: claudeResponse(raw), serve: false };
      return { events: [ev(c.red(`zsh: command not found: ${parts[0]}`))], serve: false };
  }
}

/** Plain-text summary of events (used for handler messages and tests). */
export function eventsToText(events) {
  return events
    .filter((e) => !e.clear)
    .map((e) => stripAnsi(e.text))
    .join("\n");
}
