// The fake 'orbit-todo' project shared by the Terminal (interpreter) and Finder.
// Pure data, no imports. Keep the contents consistent with PROJECT_SUMMARY below.

export const PROJECT_NAME = "orbit-todo";

export const PROJECT_FILES = {
  ".gitignore": "node_modules\ndist\n.env.local\n",
  "package.json":
    '{\n  "name": "orbit-todo",\n  "version": "0.3.1",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "test": "vitest run"\n  },\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.3.1",\n    "jsdom": "^24.1.0",\n    "vite": "^5.4.2",\n    "vitest": "^1.6.0"\n  }\n}',
  "README.md":
    "# orbit-todo\n\nA small focus-friendly todo app: add tasks with an optional due date, tick them\noff, and filter by status (all, active, done). Built with React and Vite.\n\nTasks live in a tiny store (src/store.js) and are saved to localStorage, so\nthey survive a reload. src/api.js can sync them to a server when VITE_API_URL\nis set; without it the app works fully offline.\n\n## Scripts\n\n- npm run dev    start the dev server on http://localhost:5173\n- npm test       run the unit tests (vitest)\n- npm run build  production build into dist/",
  "index.html":
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Orbit Todo</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
  "vite.config.js":
    "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { port: 5173 },\n  test: { environment: 'jsdom' },\n});\n",
  "src/main.jsx":
    "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n",
  "src/App.jsx":
    "import { useStore } from './store.js';\nimport AddTodo from './components/AddTodo.jsx';\nimport FilterBar from './components/FilterBar.jsx';\nimport TodoList from './components/TodoList.jsx';\n\nexport default function App() {\n  const { todos, filter } = useStore();\n  const left = todos.filter((t) => !t.done).length;\n\n  return (\n    <main className=\"app\">\n      <h1>Orbit Todo</h1>\n      <AddTodo />\n      <FilterBar active={filter} />\n      <TodoList todos={todos} filter={filter} />\n      <p className=\"count\">{left} left</p>\n    </main>\n  );\n}\n",
  "src/store.js":
    "import { useSyncExternalStore } from 'react';\nimport { syncTodos } from './api.js';\n\nconst KEY = 'orbit-todo:v1';\nconst load = () => {\n  try {\n    return JSON.parse(localStorage.getItem(KEY)) || [];\n  } catch {\n    return [];\n  }\n};\n\nlet state = { todos: load(), filter: 'all' };\nconst listeners = new Set();\n\nfunction set(next) {\n  state = { ...state, ...next };\n  localStorage.setItem(KEY, JSON.stringify(state.todos));\n  listeners.forEach((l) => l());\n  syncTodos(state.todos);\n}\n\nexport const actions = {\n  add(text, due) {\n    const clean = text.trim();\n    if (!clean) return;\n    set({ todos: [...state.todos, { id: Date.now(), text: clean, due, done: false }] });\n  },\n  toggle(id) {\n    set({ todos: state.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });\n  },\n  remove(id) {\n    set({ todos: state.todos.filter((t) => t.id !== id) });\n  },\n  setFilter(filter) {\n    set({ filter });\n  },\n};\n\nexport const getState = () => state;\nexport const reset = (todos = []) => { state = { todos, filter: 'all' }; };\n\nexport function useStore() {\n  return useSyncExternalStore(\n    (cb) => (listeners.add(cb), () => listeners.delete(cb)),\n    getState,\n  );\n}\n",
  "src/api.js":
    "const BASE = import.meta.env?.VITE_API_URL;\n\n// Optional server sync. Does nothing when no API URL is configured.\nexport async function syncTodos(todos) {\n  if (!BASE) return { synced: false };\n  try {\n    const res = await fetch(BASE + '/todos', {\n      method: 'PUT',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify(todos),\n    });\n    return { synced: res.ok };\n  } catch {\n    return { synced: false };\n  }\n}\n",
  "src/components/AddTodo.jsx":
    "import { useState } from 'react';\nimport { actions } from '../store.js';\n\nexport default function AddTodo() {\n  const [text, setText] = useState('');\n  const [due, setDue] = useState('');\n\n  const submit = (e) => {\n    e.preventDefault();\n    actions.add(text, due || undefined);\n    setText('');\n    setDue('');\n  };\n\n  return (\n    <form onSubmit={submit} className=\"add\">\n      <input value={text} onChange={(e) => setText(e.target.value)} placeholder=\"What needs doing?\" />\n      <input type=\"date\" value={due} onChange={(e) => setDue(e.target.value)} />\n      <button type=\"submit\">Add</button>\n    </form>\n  );\n}\n",
  "src/components/FilterBar.jsx":
    "import { actions } from '../store.js';\n\nconst FILTERS = ['all', 'active', 'done'];\n\nexport default function FilterBar({ active }) {\n  return (\n    <nav className=\"filters\">\n      {FILTERS.map((f) => (\n        <button key={f} className={f === active ? 'on' : ''} onClick={() => actions.setFilter(f)}>\n          {f}\n        </button>\n      ))}\n    </nav>\n  );\n}\n",
  "src/components/TodoList.jsx":
    "import TodoItem from './TodoItem.jsx';\n\nexport function visible(todos, filter) {\n  if (filter === 'active') return todos.filter((t) => !t.done);\n  if (filter === 'done') return todos.filter((t) => t.done);\n  return todos;\n}\n\nexport default function TodoList({ todos, filter }) {\n  const items = visible(todos, filter);\n  if (!items.length) return <p className=\"empty\">Nothing here yet.</p>;\n  return (\n    <ul>\n      {items.map((t) => (\n        <TodoItem key={t.id} todo={t} />\n      ))}\n    </ul>\n  );\n}\n",
  "src/components/TodoItem.jsx":
    "import { actions } from '../store.js';\nimport { formatDue } from '../utils/format.js';\n\nexport default function TodoItem({ todo }) {\n  return (\n    <li className={todo.done ? 'done' : ''}>\n      <input type=\"checkbox\" checked={todo.done} onChange={() => actions.toggle(todo.id)} />\n      <span>{todo.text}</span>\n      <small>{formatDue(todo.due)}</small>\n      <button aria-label=\"Delete\" onClick={() => actions.remove(todo.id)}>x</button>\n    </li>\n  );\n}\n",
  "src/utils/format.js":
    "export function formatDue(due) {\n  if (!due) return '';\n  const d = new Date(due);\n  if (Number.isNaN(d.getTime())) return '';\n  return d.toLocaleDateString();\n}\n\nexport function isOverdue(due, now = new Date()) {\n  if (!due) return false;\n  return new Date(due) < new Date(now.toDateString());\n}\n",
  "src/styles.css":
    ":root {\n  --bg: #ffffff;\n  --fg: #1c1c1e;\n  --accent: #6c5ce7;\n}\n\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--fg);\n  font-family: system-ui, sans-serif;\n}\n\n.app {\n  max-width: 480px;\n  margin: 4rem auto;\n}\n",
  "tests/format.test.js":
    "import { describe, it, expect } from 'vitest';\nimport { formatDue, isOverdue } from '../src/utils/format.js';\n\ndescribe('format', () => {\n  it('returns empty for no date', () => {\n    expect(formatDue()).toBe('');\n  });\n  it('returns empty for an invalid date', () => {\n    expect(formatDue('not a date')).toBe('');\n  });\n  it('flags past dates as overdue', () => {\n    expect(isOverdue('2020-01-01', new Date('2026-10-26'))).toBe(true);\n  });\n  it('does not flag missing dates', () => {\n    expect(isOverdue(undefined)).toBe(false);\n  });\n});\n",
  "tests/store.test.js":
    "import { describe, it, expect, beforeEach } from 'vitest';\nimport { actions, getState, reset } from '../src/store.js';\nimport { visible } from '../src/components/TodoList.jsx';\n\nbeforeEach(() => reset([]));\n\ndescribe('store', () => {\n  it('adds a trimmed todo', () => {\n    actions.add('  write docs ');\n    expect(getState().todos[0].text).toBe('write docs');\n  });\n  it('ignores blank text', () => {\n    actions.add('   ');\n    expect(getState().todos).toHaveLength(0);\n  });\n  it('toggles done', () => {\n    actions.add('a');\n    actions.toggle(getState().todos[0].id);\n    expect(getState().todos[0].done).toBe(true);\n  });\n  it('removes a todo', () => {\n    actions.add('a');\n    actions.remove(getState().todos[0].id);\n    expect(getState().todos).toHaveLength(0);\n  });\n  it('filters active todos', () => {\n    expect(visible([{ done: true }, { done: false }], 'active')).toHaveLength(1);\n  });\n  it('filters done todos', () => {\n    expect(visible([{ done: true }, { done: false }], 'done')).toHaveLength(1);\n  });\n});\n",
};

/** Nested { dir: {...}, file: "text" } tree built from PROJECT_FILES. */
export function buildProjectTree() {
  const root = {};
  for (const [path, text] of Object.entries(PROJECT_FILES)) {
    const parts = path.split("/");
    let node = root;
    parts.slice(0, -1).forEach((p) => {
      node[p] = node[p] || {};
      node = node[p];
    });
    node[parts[parts.length - 1]] = text;
  }
  return root;
}

/** Order the agent reads files in (most informative first). */
export const READ_ORDER = [
  "package.json",
  "README.md",
  "vite.config.js",
  "src/main.jsx",
  "src/App.jsx",
  "src/store.js",
  "src/api.js",
  "src/components/AddTodo.jsx",
  "src/components/FilterBar.jsx",
  "src/components/TodoList.jsx",
  "src/components/TodoItem.jsx",
  "src/utils/format.js",
  "tests/store.test.js",
  "tests/format.test.js",
];

export const PROJECT_SUMMARY = [
  "orbit-todo is a small React 18 + Vite todo app (v0.3.1).",
  "Users add tasks with an optional due date, tick them off, delete them and filter by all, active or done.",
  "State lives in a tiny external store (src/store.js) read through useSyncExternalStore and saved to localStorage; src/api.js can sync todos to a server when VITE_API_URL is set and is a no-op otherwise.",
  "The UI is split into AddTodo, FilterBar, TodoList and TodoItem components under src/components, with date helpers in src/utils/format.js.",
  "Tests (vitest + jsdom) cover the store actions, list filtering and date formatting: 10 tests in tests/.",
  "Run it with npm run dev (http://localhost:5173), test with npm test, ship with npm run build.",
];

/** Look up a file by a loose name: 'App.jsx', 'src/App.jsx', 'package'. */
export function findProjectFile(name) {
  const raw = String(name || "")
    .trim()
    .replace(/^\.?\//, "")
    .replace(/^~?\/?(home\/guest\/)?orbit-todo\//, "");
  if (!raw) return null;
  if (raw in PROJECT_FILES) return { path: raw, text: PROJECT_FILES[raw] };
  const lower = raw.toLowerCase();
  const paths = Object.keys(PROJECT_FILES);
  const base = (p) => p.split("/").pop().toLowerCase();
  const stripExt = (s) => s.replace(/\.[a-z0-9]+$/i, "");
  const hit =
    paths.find((p) => p.toLowerCase() === lower) ||
    paths.find((p) => base(p) === lower) ||
    paths.find((p) => stripExt(base(p)) === stripExt(lower)) ||
    paths.find((p) => p.toLowerCase().endsWith("/" + lower));
  return hit ? { path: hit, text: PROJECT_FILES[hit] } : null;
}

/**
 * Listing plus trimmed contents, total under maxChars.
 * Returns { text, files: [paths included] }.
 */
export function projectDigest({ maxChars = 5800, perFile = 340, only } = {}) {
  const paths = Object.keys(PROJECT_FILES).sort();
  const lines = [
    `Project ${PROJECT_NAME}/ (${paths.length} files):`,
    ...paths.map((p) => "  " + p),
    "",
  ];
  let used = lines.join("\n").length;
  const included = [];
  const order = only ? only : READ_ORDER.concat(paths.filter((p) => !READ_ORDER.includes(p)));
  for (const p of order) {
    const text = PROJECT_FILES[p];
    if (text == null) continue;
    const body =
      text.length > perFile ? text.slice(0, perFile).trimEnd() + "\n... (trimmed)" : text.trimEnd();
    const block = `--- ${p} ---\n${body}\n`;
    if (used + block.length + 1 > maxChars) continue;
    lines.push(block);
    used += block.length + 1;
    included.push(p);
  }
  return { text: lines.join("\n"), files: included };
}
