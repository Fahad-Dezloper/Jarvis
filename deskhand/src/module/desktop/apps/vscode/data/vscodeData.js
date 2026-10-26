export const INITIAL_FILES = {
  "src/App.jsx": `import React from 'react';
import Greeting from './components/Greeting';
import TodoList from './components/TodoList';

export default function App() {
  return (
    <div className="app min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans">
      <header className="py-4 border-b border-zinc-900 px-8">
        <span className="font-bold text-sm tracking-tight text-white uppercase">Hello Jarvis</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <Greeting name="friend" />
        <TodoList />
      </main>
    </div>
  );
}`,
  "src/components/Greeting.jsx": `import React from 'react';

export default function Greeting({ name }) {
  return (
    <section className="space-y-3">
      <h1 className="text-4xl font-black tracking-tight text-white">Hello, {name}!</h1>
      <p className="text-base text-zinc-400 leading-relaxed">
        This is a small demo project living inside the Jarvis code editor.
      </p>
    </section>
  );
}`,
  "src/components/TodoList.jsx": `import React from 'react';

const TODOS = ['Water the plants', 'Write a note', 'Play some music'];

export default function TodoList() {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-white">Today</h2>
      <ul className="space-y-2">
        {TODOS.map((todo) => (
          <li key={todo} className="text-sm text-zinc-300">
            {todo}
          </li>
        ))}
      </ul>
    </section>
  );
}`,
  "src/index.css": `:root {
  --primary: #007acc;
  --background: #0a0a0a;
}

body {
  margin: 0;
  font-family: 'Inter', -apple-system, sans-serif;
  background-color: var(--background);
  color: #f3f3f3;
}`,
  "tailwind.config.js": `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vscode: "#007acc"
      }
    }
  },
  plugins: [],
}`,
  "package.json": `{
  "name": "hello-deskhand",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  },
  "dependencies": {
    "react": "^19.2.0",
    "tailwindcss": "^4.1.17"
  }
}`,
  "jsconfig.json": `{
  "compilerOptions": {
    "target": "ES6",
    "module": "commonjs",
    "baseUrl": "./src",
    "paths": {
      "@components/*": ["components/*"]
    }
  }
}`,
  ".env": `NEXT_PUBLIC_SITE_NAME=hello-deskhand
PORT=3000
NODE_ENV=development`,
  "README.md": `# Hello Jarvis

A tiny demo project inside the Jarvis code editor. Open, edit and browse these files, or ask Jarvis to do it for you by voice.

## Run Project Locally
Install dependencies:
\`\`\`bash
npm install
\`\`\`

Run local dev server:
\`\`\`bash
npm run dev
\`\`\`
`,
};

export const extensionsList = [
  {
    name: "GitHub Copilot",
    desc: "Your AI pair programmer",
    publisher: "GitHub",
    version: "v1.254",
  },
  { name: "Prettier", desc: "Opinionated code formatter", publisher: "Prettier", version: "v10.2" },
  {
    name: "Tailwind CSS IntelliSense",
    desc: "Intelligent Tailwind CSS tooling",
    publisher: "Tailwind Labs",
    version: "v0.11",
  },
  {
    name: "GitLens",
    desc: "Supercharge Git within VS Code",
    publisher: "GitKraken",
    version: "v15.0",
  },
  {
    name: "ESLint",
    desc: "Integrates ESLint into VS Code",
    publisher: "Microsoft",
    version: "v2.4",
  },
  {
    name: "Dracula Theme",
    desc: "A dark theme for many editors",
    publisher: "Dracula",
    version: "v2.24",
  },
];
