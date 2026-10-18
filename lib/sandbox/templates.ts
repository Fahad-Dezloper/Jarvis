import type { SandpackFiles } from "@codesandbox/sandpack-react";
import { RUNTIME_FILE_PATH, runtimeEntrySnippet, runtimeFiles } from "./runtimeHook";

export type InputKind = "react" | "html" | "svg" | "css";

export interface ImportedSource {
  name: string;
  code: string;
  kind: InputKind;
}

export interface SandboxProject {
  template: "react-ts" | "vanilla";
  files: SandpackFiles;
  dependencies: Record<string, string>;
  externalResources: string[];
  activeFile: string;
  visibleFiles: string[];
  /** Human-readable problems that did not stop the build. */
  warnings: string[];
}

export const SANDBOX_DEPENDENCIES: Record<string, string> = {
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  gsap: "^3.12.5",
  motion: "^12.0.0",
};

/** Tailwind v4 browser build, loaded as a script inside the preview. */
export const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

const STAGE_CSS = `html, body { margin: 0; min-height: 100%; }
body {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0b0b10;
  color: #ececf3;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
`;

const REACT_EXT = /\.(tsx|jsx|ts|js|mjs)$/i;

export function kindFromName(name: string): InputKind | null {
  const lower = name.toLowerCase();
  if (REACT_EXT.test(lower)) return "react";
  if (/\.(html?)$/.test(lower)) return "html";
  if (lower.endsWith(".svg")) return "svg";
  if (lower.endsWith(".css")) return "css";
  return null;
}

/** Guess what a pasted snippet is. */
export function detectKind(code: string): InputKind {
  const t = code.trim();
  if (/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(t)) return "svg";
  if (/^<!doctype html|^<html[\s>]/i.test(t)) return "html";
  if (/\b(import|export)\b|=>|\bfunction\b|\bconst\b|return\s*\(/.test(t)) return "react";
  if (/^</.test(t)) return "html";
  if (/\{[^}]*:[^}]*\}/.test(t)) return "css";
  return "react";
}

function baseName(name: string): string {
  const file = name.split("/").pop() ?? name;
  const stem = file.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "");
  return stem || "Component";
}

/**
 * Make sure a component file has a default export so the App wrapper can
 * import it. Returns the (possibly extended) code and whether a component
 * was found.
 */
export function ensureDefaultExport(code: string): { code: string; found: boolean } {
  if (/\bexport\s+default\b/.test(code)) return { code, found: true };
  const named =
    /\bexport\s+(?:async\s+)?(?:function|class|const)\s+([A-Z][A-Za-z0-9_]*)/.exec(code) ??
    /^\s*(?:async\s+)?(?:function|class|const)\s+([A-Z][A-Za-z0-9_]*)/m.exec(code);
  if (!named) return { code, found: false };
  return { code: `${code.replace(/\s*$/, "")}\n\nexport default ${named[1]};\n`, found: true };
}

function injectIntoHead(html: string, snippet: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${snippet}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${snippet}</head>`);
  return html;
}

function wrapDocument(body: string, extraHead = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${extraHead}
</head>
<body>
${body}
</body>
</html>
`;
}

const CSS_DEMO_MARKUP = `<main class="stage">
  <div class="box card">
    <h1 class="title">Heading</h1>
    <p class="text">Your stylesheet is applied to this sample markup.</p>
    <button class="button btn">Button</button>
  </div>
</main>`;

function buildReact(main: ImportedSource, extraCss: ImportedSource[]): SandboxProject {
  const warnings: string[] = [];
  let stem = baseName(main.name);
  if (["App", "index", "styles", "mb-stage"].includes(stem)) stem = "Imported";
  const ext = /\.(tsx|jsx|ts|js)$/i.exec(main.name)?.[1].toLowerCase() ?? "tsx";
  const componentPath = `/${stem}.${ext === "ts" ? "tsx" : ext === "js" ? "jsx" : ext}`;

  const wrapped = ensureDefaultExport(main.code);
  if (!wrapped.found) {
    warnings.push("No exported React component was found. Export one with `export default`.");
  }

  const cssPaths = extraCss.map((_, i) => `/styles-${i + 1}.css`);
  const files: SandpackFiles = {
    "/index.tsx": {
      hidden: true,
      code:
        `${runtimeEntrySnippet()}import { createRoot } from "react-dom/client";\n` +
        `import "./mb-stage.css";\n` +
        cssPaths.map((p) => `import "${p.replace("/", "./")}";\n`).join("") +
        `import App from "./App";\n\n` +
        `createRoot(document.getElementById("root")!).render(<App />);\n`,
    },
    "/App.tsx": {
      hidden: true,
      code:
        `import Component from "./${stem}";\n\n` +
        `export default function App() {\n  return <Component />;\n}\n`,
    },
    "/mb-stage.css": { hidden: true, code: STAGE_CSS },
    "/public/index.html": {
      hidden: true,
      code: wrapDocument('<div id="root"></div>'),
    },
    [componentPath]: { code: wrapped.code, active: true },
    ...runtimeFiles(),
  };
  extraCss.forEach((c, i) => {
    files[cssPaths[i]] = { code: c.code };
  });

  return {
    template: "react-ts",
    files,
    dependencies: SANDBOX_DEPENDENCIES,
    externalResources: [TAILWIND_CDN],
    activeFile: componentPath,
    visibleFiles: [componentPath, ...cssPaths],
    warnings,
  };
}

function buildVanilla(main: ImportedSource, extraCss: ImportedSource[]): SandboxProject {
  const warnings: string[] = [];
  const cssPaths: string[] = [];
  const files: SandpackFiles = {};

  let html: string;
  if (main.kind === "svg") {
    html = wrapDocument(`<div class="mb-svg">\n${main.code}\n</div>`);
  } else if (main.kind === "css") {
    html = wrapDocument(CSS_DEMO_MARKUP);
    files["/user.css"] = { code: main.code, active: true };
    cssPaths.push("/user.css");
  } else {
    html = /<html[\s>]|<!doctype/i.test(main.code) ? main.code : wrapDocument(main.code);
  }

  extraCss.forEach((c, i) => {
    const p = `/styles-${i + 1}.css`;
    files[p] = { code: c.code };
    cssPaths.push(p);
  });

  // The entry script runs first (it hosts the runtime import) so it goes at the top of <head>.
  html = injectIntoHead(html, `<script src="index.js"></script>`);

  files["/index.html"] = { code: html, active: main.kind !== "css" };
  files["/index.js"] = {
    hidden: true,
    code:
      `${runtimeEntrySnippet()}import "./mb-stage.css";\n` +
      cssPaths.map((p) => `import ".${p}";\n`).join(""),
  };
  files["/mb-stage.css"] = {
    hidden: true,
    code: main.kind === "html" ? "" : STAGE_CSS + ".mb-svg svg { max-width: 80vw; max-height: 80vh; }\n",
  };
  Object.assign(files, runtimeFiles());

  const activeFile = main.kind === "css" ? "/user.css" : "/index.html";
  return {
    template: "vanilla",
    files,
    dependencies: SANDBOX_DEPENDENCIES,
    externalResources: [TAILWIND_CDN],
    activeFile,
    visibleFiles: [activeFile, ...cssPaths.filter((p) => p !== activeFile), ...(activeFile === "/index.html" ? [] : ["/index.html"])],
    warnings,
  };
}

/**
 * Build a Sandpack project from imported sources. The first non-CSS source is
 * the main one; any CSS files alongside it are attached as stylesheets.
 */
export function buildProject(sources: ImportedSource[]): SandboxProject {
  if (sources.length === 0) throw new Error("Nothing to import.");
  const main = sources.find((s) => s.kind !== "css") ?? sources[0];
  const extraCss = sources.filter((s) => s !== main && s.kind === "css");
  return main.kind === "react" ? buildReact(main, extraCss) : buildVanilla(main, extraCss);
}

export { RUNTIME_FILE_PATH };
