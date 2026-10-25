import Link from "next/link";
import "../../styles/docs.css";
import CodeBlock from "@module/docs/CodeBlock";
import Callout from "@module/docs/Callout";
import Diagram from "@module/docs/Diagram";
import Toc from "@module/docs/Toc";
import * as S from "@module/docs/snippets";

export const metadata = {
  title: "Deskhand Docs",
  description:
    "Vision, architecture, the v1 JSON protocol, the Claude Code bridge and the security model behind Deskhand, a voice-first desktop launcher.",
};

const TOC = [
  { id: "vision", label: "Vision" },
  { id: "status", label: "What is real in V1" },
  { id: "architecture", label: "Architecture" },
  { id: "protocol", label: "Protocol v1" },
  { id: "example-link", label: "Example: save a link" },
  { id: "example-resize", label: "Example: resize windows" },
  { id: "executors", label: "Action to executor map" },
  { id: "context", label: "Context providers (macOS)" },
  { id: "notion", label: "Notion and Notes targets" },
  { id: "shell", label: "Hotkey and launcher shell" },
  { id: "claude-code", label: "Claude Code bridge" },
  { id: "security", label: "Security model" },
  { id: "roadmap", label: "Roadmap" },
  { id: "references", label: "References" },
];

function Table({ head, rows }) {
  return (
    <div className="dh-table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={i}>{i === 0 ? <code>{cell}</code> : cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer">
    {children}
  </a>
);

export default function DocsPage() {
  return (
    <div className="dh-docs">
      <header className="dh-top">
        <span className="dh-brand">Deskhand / Docs</span>
        <Link href="/" className="dh-back">
          <span aria-hidden="true">&larr;</span> Back to desktop
        </Link>
      </header>

      <div className="dh-shell">
        <Toc items={TOC} />

        <div className="dh-main">
          <div className="dh-hero">
            <span className="dh-eyebrow">Protocol v1 / Infrastructure notes</span>
            <h1>Speak loosely. Deskhand does the rest.</h1>
            <p>
              Deskhand is a voice-first desktop launcher: you hold your dictation key, say what you
              want in your own words, and a model turns it into a small, checked plan that runs on
              your computer. This page explains the idea, the architecture, the wire protocol and
              the safety model, for judges and future contributors.
            </p>
          </div>

          <section id="vision">
            <h2>Vision</h2>
            <p>
              People have wanted a Jarvis for a long time: say a thing, and the computer does it.
              Built-in assistants are great at one-shot questions and single app commands. Where
              they have more room to grow is multi-step control that crosses apps, such as reading
              what is in your browser and filing it somewhere useful.
            </p>
            <p>
              What changed is dictation. Modern dictation is accurate enough that speaking loosely
              works, with half sentences, corrections and filler. That makes speech a good front
              door for a launcher, and it lets a model do the part it is good at: turning loose
              language into structure.
            </p>
            <div className="dh-cards">
              <div className="dh-card">
                <h4>1. Loose speech</h4>
                <p>&ldquo;Save this Claude artifact link to my notes.&rdquo;</p>
              </div>
              <div className="dh-card">
                <h4>2. Structured intent</h4>
                <p>A model reads the speech plus local context and returns a typed Plan.</p>
              </div>
              <div className="dh-card">
                <h4>3. Safe actions</h4>
                <p>A policy gate checks each action, then small executors perform it.</p>
              </div>
            </div>
            <p>
              The idea in one line:{" "}
              <strong>loose speech to structured intent to safe actions.</strong>
            </p>
          </section>

          <section id="status">
            <h2>What is real in V1, and what is simulated</h2>
            <p>
              The website you are looking at is{" "}
              <strong>V1: a browser demo on a simulated desktop</strong>. The real launcher (macOS
              first) is <strong>coming soon</strong> and does not exist yet.
            </p>
            <Table
              head={["Piece", "Status in the web demo"]}
              rows={[
                [
                  "voice to text",
                  "Real flow: text arrives in a focused input. In the demo this is whatever dictation app or keyboard you use.",
                ],
                [
                  "text to model",
                  "Real: the command bar calls a model for a plan, with an offline rule-based fallback.",
                ],
                [
                  "action schema",
                  "Real: the Action union and capability registry in src/deskhand/contract.js and capabilities.js.",
                ],
                [
                  "apps and windows",
                  "Simulated: Notes, Terminal, Browser and the rest are React components, not your real apps.",
                ],
                [
                  "macOS control",
                  "Not built yet: AppleScript, System Events, Claude Code and Notion executors are design only.",
                ],
              ]}
            />
            <Callout kind="note" title="Not an official integration">
              Deskhand does not claim any official integration with Wispr Flow or any other
              dictation product. It only needs a focused text field, which every dictation tool can
              type into.
            </Callout>
          </section>

          <section id="architecture">
            <h2>Architecture</h2>
            <p>
              Dictation lands in the launcher input. Context providers collect a small, local
              snapshot. The planner (a model with structured output) returns a Plan. A policy and
              consent gate approves, previews or blocks each action. Executors perform approved
              actions, and results go back to the user and into a local audit log.
            </p>
            <Diagram />
            <ul>
              <li>
                <strong>The model sees only the planner box.</strong> It never holds credentials and
                never runs anything itself.
              </li>
              <li>
                <strong>Executors are small and boring.</strong> Each one does one kind of thing
                (AppleScript, an HTTP call, a scoped Claude Code run) and validates its inputs.
              </li>
              <li>
                <strong>One registry.</strong> The same capability registry feeds the planner
                prompt, the policy gate and the executors, so they cannot drift apart.
              </li>
            </ul>
          </section>

          <section id="protocol">
            <h2>Protocol v1</h2>
            <p>
              Five message shapes, all JSON, all versioned: <code>Intent</code>,{" "}
              <code>Context</code>, <code>Plan</code>, <code>Action</code> and <code>Result</code>.
              The web demo&apos;s <code>CONTRACT_VERSION</code> is already <code>1</code>; the
              native launcher uses the same Action union so a plan written for the demo is valid for
              the real thing.
            </p>
            <CodeBlock lang="json" title="envelope" code={S.ENVELOPE} />
            <h3>Action union</h3>
            <CodeBlock lang="typescript" title="Action (from the web demo)" code={S.ACTION_UNION} />
            <h3>Capabilities via invoke</h3>
            <p>
              <code>invoke</code> is the extension point: <code>{`{ app, name, args }`}</code> names
              a capability from the registry. The web demo ships capabilities such as{" "}
              <code>notes.append_note</code>, <code>browser.copy_link</code> and{" "}
              <code>music.play</code>. The native launcher adds more, marked <em>proposed</em>{" "}
              below.
            </p>
            <CodeBlock
              lang="json"
              title="capability registry (proposed native shape)"
              code={S.REGISTRY}
            />
            <h3>Rules every implementation follows</h3>
            <ul>
              <li>
                Unknown <code>v</code>, <code>type</code>, action type or capability: reject the
                whole plan.
              </li>
              <li>
                The model never sets <code>risk</code>. The policy layer derives it from the
                registry and overrides anything the model claims.
              </li>
              <li>
                Later actions may read earlier output with{" "}
                <code>{`{ "$ref": "a1.output.url" }`}</code>, so the model does not have to retype
                (or be handed) data it does not need.
              </li>
              <li>
                Context fields carry a <code>trust</code> label. Anything from a page, window title
                or clipboard is <code>untrusted</code>: data, never instructions.
              </li>
            </ul>
            <Callout kind="design">
              The <code>$ref</code> bindings, <code>risk</code>, <code>trust</code>, action{" "}
              <code>id</code> and the native capability names are the proposed v1 extensions for the
              macOS launcher. The web demo implements the Action union, plan/step/done events and
              the capability registry, not these extras.
            </Callout>
          </section>

          <section id="example-link">
            <h2>
              Worked example 1: &ldquo;save this Claude artifact link from my browser to my
              notes&rdquo;
            </h2>
            <h3>Intent and Context</h3>
            <CodeBlock lang="json" title="Intent" code={S.INTENT} />
            <CodeBlock lang="json" title="Context (browser provider)" code={S.CONTEXT_1} />
            <h3>Plan</h3>
            <CodeBlock lang="json" title="Plan" code={S.PLAN_1} />
            <h3>How the executors run it</h3>
            <p>
              <code>browser.get_active_tab</code> is a read-only AppleScript run through{" "}
              <code>osascript</code>. <code>notes.append_link</code> is a reversible append to Apple
              Notes, or <code>notion.append_bookmark</code> if the user configured a Notion target.
            </p>
            <CodeBlock lang="bash" title="read the active tab" code={S.OSA_CHROME} />
            <Callout kind="unverified">
              The shape <code>osascript -e &apos;tell application &quot;X&quot; to ...&apos;</code>{" "}
              and <code>tell application</code> blocks are verified (see references). The specific
              Chrome and Safari property names (<code>active tab</code>, <code>URL</code>,{" "}
              <code>current tab</code>) could not be confirmed from an official page during this
              research. Check each app&apos;s scripting dictionary in Script Editor before shipping.
            </Callout>
            <CodeBlock
              lang="bash"
              title="Apple Notes target (no token needed)"
              code={S.OSA_NOTES}
            />
            <CodeBlock
              lang="bash"
              title="Notion target (needs token + shared page)"
              code={S.NOTION_CURL}
            />
            <h3>Result</h3>
            <CodeBlock lang="json" title="Result" code={S.RESULT_1} />
          </section>

          <section id="example-resize">
            <h2>Worked example 2: &ldquo;resize my notepads so they all look good&rdquo;</h2>
            <p>
              &ldquo;Notepads&rdquo; is ambiguous (Notes windows, Stickies, an editor). The planner
              resolves it from context, here the frontmost app, and states the assumption in the
              reply. Geometry is never left to the model: the plan says <code>tile grid</code> and
              the launcher computes rectangles from the screen&apos;s visible frame.
            </p>
            <CodeBlock lang="json" title="Context (windows provider)" code={S.CONTEXT_2} />
            <CodeBlock lang="json" title="Plan" code={S.PLAN_2} />
            <CodeBlock lang="bash" title="native executor for tile" code={S.OSA_WINDOWS} />
            <Callout kind="verified">
              Apple documents that driving another app&apos;s windows through System Events
              (&ldquo;UI scripting&rdquo;) needs Accessibility control, which is off by default,
              must be enabled per app (including script apps), and requires admin credentials.
            </Callout>
            <Callout kind="unverified">
              The <code>position</code> and <code>size</code> window properties and reading the
              screen&apos;s visible frame are not confirmed from an official page here. Treat the
              script as a sketch to validate on a real Mac.
            </Callout>
            <CodeBlock lang="json" title="Result" code={S.RESULT_2} />
          </section>

          <section id="executors">
            <h2>How the Action union maps to native executors</h2>
            <p>
              The web demo performs each action against simulated windows. The native launcher keeps
              the same action and swaps the executor.
            </p>
            <Table
              head={["Action", "Web demo (V1)", "Native executor (design)"]}
              rows={[
                [
                  "open / focus",
                  "Opens or raises a simulated window",
                  "Activate the app via AppleScript (tell application)",
                ],
                [
                  "close / minimize / maximize / restore",
                  "Window store state",
                  "System Events window controls (Accessibility)",
                ],
                [
                  "move / resize",
                  "Updates window rect",
                  "System Events set position / size (Accessibility)",
                ],
                [
                  "tile",
                  "Grid, columns, rows, cascade layout",
                  "Launcher computes rects, then move + resize each window; snapshot for undo",
                ],
                [
                  "click / type",
                  "Drives the simulated app",
                  "System Events UI scripting (Accessibility); highest risk, off by default",
                ],
                [
                  "invoke",
                  "Registered app handlers (notes, browser, music, ...)",
                  "Registry executor: AppleScript, HTTP (Notion), or Claude Code headless",
                ],
                ["say", "Text in the command bar", "Overlay text, later TTS"],
              ]}
            />
          </section>

          <section id="context">
            <h2>Context providers and macOS permissions</h2>
            <p>
              Providers are small read-only functions. Each returns one field of the Context message
              and a trust label. They run locally and only when the intent needs them.
            </p>
            <Table
              head={["Provider", "How (design)", "Permission"]}
              rows={[
                [
                  "frontmost app",
                  "System Events process list, frontmost flag",
                  "Automation for System Events (unverified)",
                ],
                [
                  "browser tabs",
                  "osascript against Chrome or Safari",
                  "Automation, per target app",
                ],
                [
                  "Notes / Music",
                  "osascript against the app's scripting dictionary",
                  "Automation, per target app",
                ],
                ["clipboard", "pbpaste / pbcopy", "None known (unverified)"],
                ["window bounds", "System Events window position and size", "Accessibility"],
                ["screenshots (not in V1)", "Screen capture", "Screen & System Audio Recording"],
              ]}
            />
            <Callout kind="verified" title="Verified: where users grant access">
              Apple lists these panes under System Settings, Privacy &amp; Security: Automation
              (apps controlling other apps), Accessibility (apps controlling the Mac with scripts),
              Screen &amp; System Audio Recording, and Input Monitoring. For Accessibility, Screen
              Recording and Input Monitoring the user adds the app with the Add button and ticks it.
              Apple&apos;s scripting guide adds that the first run of an app needing Accessibility
              prompts the user, and running without permission produces an error.
            </Callout>
            <Callout kind="unverified">
              Not confirmed from an official page: the exact wording and timing of the per-app
              Automation consent prompt, and whether Spotify (as opposed to Apple Music) exposes a
              scripting dictionary. The launcher should detect denial errors and show a &ldquo;grant
              access&rdquo; hint instead of failing silently. The Input Monitoring pane is not
              needed by V1.
            </Callout>
          </section>

          <section id="notion">
            <h2>Notion and Apple Notes as the &ldquo;save to notes&rdquo; target</h2>
            <p>
              <strong>Apple Notes</strong> needs no token: the launcher talks to the Notes app
              through AppleScript after the user grants Automation access. <strong>Notion</strong>{" "}
              is the cross-platform option and needs setup.
            </p>
            <ul>
              <li>
                Create an internal connection in Notion&apos;s developer portal and copy its token
                from the Configuration tab. Treat it as a secret and read it from the environment or
                the macOS keychain, never from a prompt.
              </li>
              <li>
                Share the destination page with the connection (page menu, Add connections).
                Requests for pages that are not shared fail.
              </li>
              <li>
                Append with <code>PATCH /v1/blocks/&#123;block_id&#125;/children</code>, sending{" "}
                <code>Authorization: Bearer</code>, <code>Notion-Version</code> and a JSON body with
                a <code>children</code> array (max 100 blocks per request).
              </li>
            </ul>
            <Callout kind="verified">
              Endpoint, headers, the 100-block limit, the <code>position</code> option, the 404 for
              inaccessible pages and 403 for missing insert capability come from Notion&apos;s API
              reference and authorization docs. The docs show <code>2026-03-11</code> as an example
              Notion-Version value.
            </Callout>
          </section>

          <section id="shell">
            <h2>Hotkey and launcher shell</h2>
            <p>
              The launcher is a small always-available window with one focused text input. Wispr
              Flow (or any dictation tool) types into whichever field has focus, so the launcher
              needs no special integration: it only has to show an input and take focus when
              summoned.
            </p>
            <Table
              head={["Option", "Global hotkey", "Notes"]}
              rows={[
                [
                  "Tauri v2",
                  "@tauri-apps/plugin-global-shortcut (Rust crate tauri-plugin-global-shortcut)",
                  "Commands are blocked until allowed in a capability file (allow-register, allow-unregister, allow-is-registered).",
                ],
                [
                  "Electron",
                  "globalShortcut.register(accelerator, callback)",
                  "Main process, after app ready. Silently fails if another app already holds the shortcut.",
                ],
                [
                  "Hammerspoon",
                  "hs.hotkey.bind(mods, key, pressedfn, ...)",
                  "Lua scripting on macOS; fastest way to prototype the launcher.",
                ],
                [
                  "Swift menu-bar app",
                  "Native (not researched)",
                  "Unverified here. Best final form for macOS-first, no web runtime.",
                ],
              ]}
            />
            <CodeBlock lang="typescript" title="Tauri: summon the launcher" code={S.HOTKEY_TAURI} />
            <Callout kind="verified" title="Verified: Wispr Flow facts">
              Wispr&apos;s help center describes Flow as typing for you &ldquo;in any app&rdquo;,
              lists Mac and Windows downloads, and gives these Mac defaults: Fn for push to talk,
              Fn+Space for hands-free, Fn+Ctrl for Command Mode. Pick a launcher hotkey that does
              not collide with the user&apos;s Flow bindings.
            </Callout>
            <Callout kind="unverified">
              No Wispr Flow developer API, SDK or integration is documented on docs.wisprflow.ai or
              in the pages read for this research. How Flow inserts text (paste versus simulated
              keys) is also not documented in the pages read. Deskhand therefore assumes nothing
              beyond a focused text field.
            </Callout>
          </section>

          <section id="claude-code">
            <h2>Claude Code bridge</h2>
            <p>
              For tasks that touch files or a codebase, the launcher hands a scoped job to Claude
              Code in non-interactive mode and streams the progress back to the overlay. The model
              that plans (Deskhand&apos;s planner) and the agent that works (Claude Code) are
              separate, and the second runs with the smallest tool set that does the job.
            </p>
            <CodeBlock
              lang="bash"
              title="headless run with a narrow tool scope"
              code={S.CLAUDE_CMD}
            />
            <h3>What each part does (verified flags)</h3>
            <Table
              head={["Flag", "Why the launcher uses it"]}
              rows={[
                [
                  "-p / --print",
                  "Non-interactive run; exit code 0 on success, non-zero on failure.",
                ],
                [
                  "--output-format",
                  "text, json or stream-json. Stream for live progress; json for the final result with session ID and cost.",
                ],
                [
                  "--verbose --include-partial-messages",
                  "Needed with stream-json to receive token-level events.",
                ],
                [
                  "--allowedTools",
                  "Pre-approves tools with permission-rule patterns, e.g. Bash(git diff *). The space before * matters.",
                ],
                [
                  "--disallowedTools",
                  "Deny rules; a scoped rule like Bash(rm *) denies only matching calls.",
                ],
                [
                  "--permission-mode",
                  "default, acceptEdits, plan, auto, dontAsk or bypassPermissions. dontAsk denies anything that would prompt.",
                ],
                [
                  "--permission-prompts none",
                  "Nobody to answer prompts: deny them (needs v2.1.259 or later).",
                ],
                [
                  "--max-turns / --max-budget-usd",
                  "Hard caps on agent turns and estimated spend (print mode).",
                ],
                [
                  "--session-id / --resume / --continue",
                  "Name a session up front, then follow up on it.",
                ],
                [
                  "--json-schema",
                  "Validated structured output, returned in the structured_output field.",
                ],
                [
                  "--bare",
                  "Skips hooks, skills, plugins, MCP servers, auto memory and CLAUDE.md for repeatable runs. Uses ANTHROPIC_API_KEY, not subscription login.",
                ],
                ["--mcp-config / --strict-mcp-config", "Load only the MCP servers you name."],
                ["--add-dir", "Extra directories Claude may read and edit."],
              ]}
            />
            <h3>Operating rules</h3>
            <ul>
              <li>
                <strong>Working directory:</strong> start the process in the project folder the task
                is about. Never in the home folder.
              </li>
              <li>
                <strong>Tools:</strong> start read-only (<code>Read</code>, <code>Grep</code>); add{" "}
                <code>Edit</code> or specific <code>Bash(...)</code> patterns per task. Do not use{" "}
                <code>bypassPermissions</code> outside a disposable container or VM.
              </li>
              <li>
                <strong>Timeouts:</strong> the launcher owns a wall-clock timeout. Send SIGINT first
                to end the turn cleanly; SIGTERM exits with code 143 and records no result for the
                turn in progress.
              </li>
              <li>
                <strong>Input:</strong> piped stdin is capped at 10 MB. Pass big context as a file
                path.
              </li>
              <li>
                <strong>Streaming:</strong> read newline-delimited JSON; the last line is a{" "}
                <code>result</code> message. With stream-json, denied calls appear as{" "}
                <code>permission_denied</code> messages and in the final{" "}
                <code>permission_denials</code>.
              </li>
              <li>
                <strong>Untrusted content:</strong> never paste page or clipboard text into the task
                prompt as instructions. Write it to a file and point to it as data.
              </li>
            </ul>
            <CodeBlock lang="bash" title="structured result" code={S.CLAUDE_STRUCTURED} />
            <h3>Alternative: the Claude Agent SDK</h3>
            <p>
              The same agent loop is available as a library (
              <code>@anthropic-ai/claude-agent-sdk</code> for TypeScript,{" "}
              <code>claude-agent-sdk</code> for Python), with callbacks for tool approval, hooks and
              native message objects. A Tauri or Electron launcher can embed it instead of spawning
              a subprocess.
            </p>
            <CodeBlock lang="typescript" title="Agent SDK sketch" code={S.CLAUDE_SDK} />
            <Callout kind="verified">
              Anthropic&apos;s docs say third-party developers may not offer claude.ai login or its
              rate limits in their products unless previously approved; use API key authentication.
              A shipped Deskhand therefore asks users for their own API key (or uses a cloud
              provider login the docs list), stored in the keychain.
            </Callout>
          </section>

          <section id="security">
            <h2>Security model</h2>
            <p>
              Voice control is powerful, so the design assumes the model can be wrong and that any
              text it reads may be hostile.
            </p>
            <h3>Risk tiers and confirmation policy</h3>
            <Table
              head={["Tier", "Examples", "Policy"]}
              rows={[
                [
                  "read_only",
                  "get active tab, list windows, read clipboard",
                  "Run without asking. Logged.",
                ],
                [
                  "reversible",
                  "append to a note, tile windows, set volume, open an app",
                  "Show a one-line preview chip; run on first use after a click, then per-target remembered. Always undoable where possible.",
                ],
                [
                  "destructive",
                  "delete files, send messages, run shell, Claude Code with Edit or Bash",
                  "Always confirm with a dry-run preview of exactly what will happen. Never remembered.",
                ],
              ]}
            />
            <h3>Controls</h3>
            <ul>
              <li>
                <strong>Allowlists:</strong> only capabilities in the registry exist. Claude Code
                runs get explicit <code>--allowedTools</code> patterns. Notion writes go only to
                pages the user shared with the integration.
              </li>
              <li>
                <strong>Dry-run preview:</strong> every plan renders as human-readable steps before
                anything above read-only runs.
              </li>
              <li>
                <strong>No secrets in prompts:</strong> tokens live in the keychain or environment
                of the executor. The planner never receives them, and clipboard text matching key
                patterns is withheld from context.
              </li>
              <li>
                <strong>Local-first context:</strong> providers run on the device. Only the fields a
                plan needs are sent to the model, and <code>$ref</code> keeps raw values out of it.
              </li>
              <li>
                <strong>Audit log:</strong> an append-only local file of intent, plan, approvals and
                results, viewable and exportable by the user.
              </li>
              <li>
                <strong>Kill switch:</strong> a global hotkey and menu-bar item that cancels the
                running plan, terminates child processes and disables executors until re-enabled.
              </li>
            </ul>
            <h3>Prompt injection</h3>
            <p>
              Page titles, URLs, window titles, notes and clipboard contents are{" "}
              <strong>data, never instructions</strong>. In practice:
            </p>
            <ul>
              <li>
                Context fields are labeled <code>untrusted</code> and wrapped as quoted data in the
                planner prompt.
              </li>
              <li>
                The planner can only return a Plan that validates against the schema; free text is
                ignored.
              </li>
              <li>
                The policy layer sets risk from the registry, so injected text cannot downgrade it.
              </li>
              <li>Destructive steps need a human click that injected text cannot produce.</li>
            </ul>
            <Callout kind="note" title="Honest limit">
              These layers reduce the risk of prompt injection; they do not eliminate it. A hostile
              page could still try to steer a reversible action, which is why previews and undo
              exist.
            </Callout>
            <h3>What V1 does not do</h3>
            <ul>
              <li>It does not control your real computer. The demo desktop is simulated.</li>
              <li>
                It does not implement the policy gate, audit log or kill switch natively (design
                only).
              </li>
              <li>It does not store tokens, read your clipboard or touch Notion or Notes.</li>
              <li>
                The demo model call is subject to the same limits as any hosted demo; do not type
                secrets into it.
              </li>
            </ul>
          </section>

          <section id="roadmap">
            <h2>Roadmap</h2>
            <Table
              head={["Stage", "Scope", "Status"]}
              rows={[
                [
                  "V1 (now)",
                  "Web demo on a simulated desktop; real voice-text-model-action loop and action schema.",
                  "Live",
                ],
                [
                  "V1.1",
                  "macOS menu-bar launcher, global hotkey, context providers (app, tabs, clipboard, windows), AppleScript and Claude Code executors, policy gate, audit log.",
                  "Coming soon",
                ],
                [
                  "V2",
                  "Voice replies (TTS), memory of preferences, more executors (Notion and others), Windows and Linux.",
                  "Planned",
                ],
              ]}
            />
            <p>
              Dates are intentionally absent. V1.1 and V2 are plans, not promises, and anything on
              this page marked Design or Unverified will be validated on real hardware before it
              ships.
            </p>
          </section>

          <section id="references">
            <h2>References</h2>
            <p>
              Pages read during research (October 2026). Anything not listed here is unverified.
            </p>
            <ul>
              <li>
                <A href="https://code.claude.com/docs/en/headless">
                  Run Claude Code programmatically (headless)
                </A>
              </li>
              <li>
                <A href="https://code.claude.com/docs/en/cli-reference">
                  Claude Code CLI reference
                </A>
              </li>
              <li>
                <A href="https://code.claude.com/docs/en/permission-modes">
                  Claude Code permission modes
                </A>
              </li>
              <li>
                <A href="https://code.claude.com/docs/en/agent-sdk/overview">Agent SDK overview</A>{" "}
                and <A href="https://code.claude.com/docs/en/agent-sdk/quickstart">quickstart</A>
              </li>
              <li>
                <A href="https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/AutomatetheUserInterface.html">
                  Apple: Automating the User Interface (System Events, Accessibility)
                </A>
              </li>
              <li>
                <A href="https://support.apple.com/guide/mac-help/control-access-to-your-mac-mchl211c911f/mac">
                  Apple: Privacy &amp; Security panes on Mac
                </A>
              </li>
              <li>
                <A href="https://ss64.com/mac/osascript.html">
                  SS64: osascript (third-party reference)
                </A>
              </li>
              <li>
                <A href="https://developers.notion.com/reference/patch-block-children">
                  Notion: Append block children
                </A>{" "}
                and <A href="https://developers.notion.com/docs/authorization">authorization</A>
              </li>
              <li>
                <A href="https://v2.tauri.app/plugin/global-shortcut/">
                  Tauri v2 global-shortcut plugin
                </A>
              </li>
              <li>
                <A href="https://www.electronjs.org/docs/latest/api/global-shortcut">
                  Electron globalShortcut
                </A>
              </li>
              <li>
                <A href="https://www.hammerspoon.org/docs/hs.hotkey.html">Hammerspoon hs.hotkey</A>
              </li>
              <li>
                <A href="https://docs.wisprflow.ai">Wispr Flow help center</A> and{" "}
                <A href="https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts">
                  keyboard shortcuts
                </A>
              </li>
            </ul>
            <p className="dh-footer">
              Markdown versions of these docs live in <code>deskhand/docs/</code>.{" "}
              <Link href="/">Back to desktop</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
