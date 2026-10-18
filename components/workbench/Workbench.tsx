"use client";

import { useCallback, useRef, useState } from "react";
import {
  SandpackCodeEditor,
  SandpackPreview,
  SandpackProvider,
  type SandpackTheme,
} from "@codesandbox/sandpack-react";
import {
  AlertTriangle,
  FileCode2,
  Link2,
  Loader2,
  Play,
  Sparkles,
  Upload,
  ClipboardPaste,
} from "lucide-react";
import { SAMPLES } from "@/lib/sandbox/samples";
import {
  buildProject,
  detectKind,
  kindFromName,
  type ImportedSource,
  type SandboxProject,
} from "@/lib/sandbox/templates";

const MAX_BYTES = 200 * 1024;

const theme: SandpackTheme = {
  colors: {
    surface1: "#0c0c12",
    surface2: "#16161f",
    surface3: "#20202c",
    clickable: "#8a8aa0",
    base: "#e6e6ef",
    disabled: "#4a4a5c",
    hover: "#ffffff",
    accent: "#8b7cff",
    error: "#ff7a7a",
    errorSurface: "#2a1418",
  },
  syntax: {
    plain: "#e6e6ef",
    comment: { color: "#5f5f78", fontStyle: "italic" },
    keyword: "#b3a8ff",
    tag: "#5ee1c1",
    punctuation: "#8a8aa0",
    definition: "#7fd0ff",
    property: "#ffb86b",
    static: "#ff9ac1",
    string: "#a5e8a0",
  },
  font: {
    body: "var(--font-geist-sans), system-ui, sans-serif",
    mono: "var(--font-geist-mono), ui-monospace, monospace",
    size: "13px",
    lineHeight: "20px",
  },
};

type Tab = "samples" | "paste" | "upload" | "github";

const TABS: { id: Tab; label: string; icon: typeof Play }[] = [
  { id: "samples", label: "Samples", icon: Sparkles },
  { id: "paste", label: "Paste", icon: ClipboardPaste },
  { id: "upload", label: "Files", icon: Upload },
  { id: "github", label: "GitHub", icon: Link2 },
];

const KIND_LABEL = { react: "React component", html: "HTML", svg: "SVG", css: "CSS" } as const;

function initialProject(): { project: SandboxProject; label: string } {
  const sample = SAMPLES[0];
  return { project: buildProject(sample.sources), label: sample.name };
}

export default function Workbench() {
  const initial = useState(initialProject)[0];
  const [project, setProject] = useState<SandboxProject>(initial.project);
  const [label, setLabel] = useState(initial.label);
  const [runId, setRunId] = useState(0);
  const [sampleId, setSampleId] = useState<string | null>(SAMPLES[0].id);
  const [tab, setTab] = useState<Tab>("samples");
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback((sources: ImportedSource[], name: string, id: string | null = null) => {
    try {
      const next = buildProject(sources);
      setProject(next);
      setLabel(name);
      setSampleId(id);
      setRunId((n) => n + 1);
      setError(next.warnings.length ? next.warnings.join(" ") : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build that input.");
    }
  }, []);

  const runPasted = () => {
    if (!pasted.trim()) return setError("Paste some code first.");
    if (pasted.length > MAX_BYTES) return setError("That is larger than 200KB.");
    const kind = detectKind(pasted);
    const ext = { react: "tsx", html: "html", svg: "svg", css: "css" }[kind];
    load([{ name: `Pasted.${ext}`, code: pasted, kind }], `Pasted ${KIND_LABEL[kind]}`);
  };

  const readFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const sources: ImportedSource[] = [];
    const skipped: string[] = [];
    for (const f of files) {
      const kind = kindFromName(f.name);
      if (!kind || f.size > MAX_BYTES) {
        skipped.push(f.name);
        continue;
      }
      sources.push({ name: f.name, code: await f.text(), kind });
    }
    if (!sources.length) {
      return setError("Drop .tsx, .jsx, .html, .svg or .css files under 200KB.");
    }
    load(sources, sources.map((s) => s.name).join(", "));
    if (skipped.length) setError(`Skipped: ${skipped.join(", ")}`);
  };

  const fetchGithub = async () => {
    if (!url.trim()) return setError("Paste a GitHub file URL first.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/import?url=${encodeURIComponent(url.trim())}`);
      const body = await res.text();
      if (!res.ok) throw new Error(body || `Request failed (${res.status})`);
      const name = decodeURIComponent(new URL(url.trim()).pathname.split("/").pop() || "Imported.tsx");
      const kind = kindFromName(name) ?? detectKind(body);
      load([{ name, code: body, kind }], name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch that URL.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-dvh min-h-[640px] flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#8b7cff] to-[#5ee1c1] text-[#0b0b10]">
            <Play className="size-4 fill-current" />
          </div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-semibold tracking-tight">Motion Brief</h1>
            <p className="text-xs text-zinc-500">Import an animation. Watch it run. Edit it live.</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
          <FileCode2 className="size-3.5" />
          <span className="max-w-[40ch] truncate">{label}</span>
        </div>
      </header>

      <SandpackProvider
        key={runId}
        template={project.template}
        theme={theme}
        files={project.files}
        customSetup={{ dependencies: project.dependencies }}
        options={{
          externalResources: project.externalResources,
          activeFile: project.activeFile,
          visibleFiles: project.visibleFiles,
          recompileMode: "delayed",
          recompileDelay: 350,
        }}
      >
        <div className="mb-sandpack grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <section
            className={`relative flex min-h-0 flex-col border-white/[0.07] lg:border-r ${dragging ? "bg-[#8b7cff]/5" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) void readFiles(e.dataTransfer.files);
            }}
          >
            <div className="border-b border-white/[0.07] bg-[#0f0f16] p-4">
              <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.04] p-1">
                {TABS.map(({ id, label: tl, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      tab === id ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {tl}
                  </button>
                ))}
              </div>

              {tab === "samples" && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {SAMPLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => load(s.sources, s.name, s.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        sampleId === s.id
                          ? "border-[#8b7cff]/60 bg-[#8b7cff]/10"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <span className="mb-1 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                        {s.tech}
                      </span>
                      <span className="block text-sm font-medium">{s.name}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{s.blurb}</span>
                    </button>
                  ))}
                </div>
              )}

              {tab === "paste" && (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    spellCheck={false}
                    placeholder="Paste a React component, HTML, SVG or CSS"
                    className="h-28 resize-none rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[#8b7cff]/60"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {pasted.trim() ? `Detected: ${KIND_LABEL[detectKind(pasted)]}` : "Auto-detects the format"}
                    </span>
                    <button onClick={runPasted} className="btn-primary">
                      <Play className="size-3.5" /> Run
                    </button>
                  </div>
                </div>
              )}

              {tab === "upload" && (
                <button
                  onClick={() => fileInput.current?.click()}
                  className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 text-zinc-400 transition hover:border-[#8b7cff]/60 hover:text-zinc-200"
                >
                  <Upload className="size-5" />
                  <span className="text-sm">Drop files here or click to browse</span>
                  <span className="text-xs text-zinc-600">.tsx .jsx .html .svg .css, up to 200KB each</span>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept=".tsx,.jsx,.ts,.js,.html,.htm,.svg,.css"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.length) void readFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </button>
              )}

              {tab === "github" && (
                <div className="flex flex-col gap-2">
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void fetchGithub()}
                    placeholder="https://github.com/owner/repo/blob/main/src/Card.tsx"
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[#8b7cff]/60"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">github.com blob or raw.githubusercontent.com only</span>
                    <button onClick={fetchGithub} disabled={busy} className="btn-primary">
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                      Fetch
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            <div className="min-h-[280px] flex-1">
              <SandpackCodeEditor showLineNumbers showTabs closableTabs={false} style={{ height: "100%" }} />
            </div>
          </section>

          <section className="min-h-[360px] bg-[#0b0b10]">
            <SandpackPreview
              showNavigator={false}
              showOpenInCodeSandbox={false}
              showRefreshButton
              style={{ height: "100%" }}
            />
          </section>
        </div>
      </SandpackProvider>
    </div>
  );
}
