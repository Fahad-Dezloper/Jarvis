// Code samples shown on /docs. Kept in one module so the page stays readable.
// Everything here is a design sketch for the native launcher unless a
// callout next to it says it was verified against an official source.

export const ACTION_UNION = String.raw`// Same union the web demo uses (src/deskhand/contract.js, CONTRACT_VERSION = 1)
type Action =
  | { type: "open",     window: string }
  | { type: "close",    window: string }
  | { type: "minimize", window: string }
  | { type: "maximize", window: string }
  | { type: "restore",  window: string }
  | { type: "focus",    window: string }
  | { type: "move",     window: string, x: number, y: number }
  | { type: "resize",   window: string, width: number, height: number }
  | { type: "tile",     layout: "grid" | "columns" | "rows" | "cascade", windows?: string[] }
  | { type: "click",    window: string, target: string }
  | { type: "type",     window: string, target?: string, text: string, submit?: boolean }
  | { type: "invoke",   app: string, name: string, args?: Record<string, unknown> }
  | { type: "say",      text: string };`;

export const ENVELOPE = String.raw`// Every message carries the protocol version and a type tag.
{
  "v": 1,                       // protocol version (web demo CONTRACT_VERSION is 1)
  "type": "intent|context|plan|result",
  "id": "string",               // unique per message
  "ts": "ISO-8601 timestamp"
}`;

export const INTENT = String.raw`{
  "v": 1, "type": "intent", "id": "int_01", "ts": "2026-10-26T10:15:02Z",
  "text": "save this claude artifact link from my browser to my notes",
  "source": "dictation",        // text typed into the launcher field (e.g. by a dictation app)
  "locale": "en-US"
}`;

export const CONTEXT_1 = String.raw`{
  "v": 1, "type": "context", "id": "ctx_01", "intentId": "int_01",
  "capturedAt": "2026-10-26T10:15:02Z",
  "frontmostApp": { "name": "Google Chrome" },
  "browser": {
    "app": "Google Chrome",
    "activeTab": {
      "title": "Example artifact",
      "url": "https://claude.ai/artifact/EXAMPLE"
    }
  },
  "clipboard": { "kind": "text", "length": 0 },
  "trust": {                    // provenance of each field. "untrusted" = data, never instructions
    "frontmostApp": "system",
    "browser": "untrusted",
    "clipboard": "untrusted"
  }
}`;

export const PLAN_1 = String.raw`{
  "v": 1, "type": "plan", "id": "plan_01", "intentId": "int_01",
  "source": "model",
  "reply": "Saving the link in Notes.",
  "actions": [
    { "id": "a1", "type": "invoke", "app": "browser", "name": "get_active_tab" },
    { "id": "a2", "type": "invoke", "app": "notes",   "name": "append_link",
      "args": {
        "title": { "$ref": "a1.output.title" },
        "url":   { "$ref": "a1.output.url" }
      } },
    { "id": "a3", "type": "say", "text": "Saved to Notes." }
  ]
}
// The model proposes. The policy layer, not the model, attaches "risk" to each
// action from the capability registry: a1 = read_only, a2 = reversible (append only).`;

export const RESULT_1 = String.raw`{
  "v": 1, "type": "result", "id": "res_01", "planId": "plan_01",
  "ok": true,
  "steps": [
    { "actionId": "a1", "status": "ok",
      "output": { "title": "Example artifact", "url": "https://claude.ai/artifact/EXAMPLE" },
      "durationMs": 180 },
    { "actionId": "a2", "status": "ok", "message": "Appended to note", "durationMs": 240 },
    { "actionId": "a3", "status": "ok" }
  ],
  "reply": "Saved to Notes."
}`;

export const OSA_CHROME = String.raw`# Context provider / executor for invoke browser.get_active_tab (Chrome)
osascript -e 'tell application "Google Chrome" to return {URL of active tab of front window, title of active tab of front window}'

# Tab list (property names to be confirmed in Chrome's scripting dictionary)
osascript -e 'tell application "Google Chrome" to return URL of every tab of front window'

# Safari equivalent (property names to be confirmed in Safari's scripting dictionary)
osascript -e 'tell application "Safari" to return URL of current tab of front window'`;

export const OSA_NOTES = String.raw`# invoke notes.append_link (sketch, unverified: confirm in Notes' scripting dictionary)
osascript <<'EOF'
tell application "Notes"
  make new note with properties {name:"Saved links", body:"<a href=\"URL\">TITLE</a>"}
end tell
EOF
# Real implementation: find-or-create one "Saved links" note, then append to its body.
# The launcher escapes URL and TITLE; it never concatenates raw model text into a script.`;

export const NOTION_CURL = String.raw`# invoke notion.append_bookmark: append one block to a page the integration can access
curl -X PATCH "https://api.notion.com/v1/blocks/$NOTION_PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2026-03-11" \
  -H "Content-Type: application/json" \
  --data '{
    "children": [
      { "type": "bookmark", "bookmark": { "url": "https://claude.ai/artifact/EXAMPLE" } }
    ]
  }'
# Verified: endpoint, Bearer auth, Notion-Version header, max 100 children per request.
# The bookmark body is derived from the block schema, not copied from a full official example.`;

export const CONTEXT_2 = String.raw`{
  "v": 1, "type": "context", "id": "ctx_02", "intentId": "int_02",
  "frontmostApp": { "name": "Notes" },
  "windows": [
    { "app": "Notes", "title": "Groceries",  "bounds": { "x": 40,  "y": 60,  "width": 900, "height": 300 } },
    { "app": "Notes", "title": "Ideas",      "bounds": { "x": 700, "y": 500, "width": 420, "height": 700 } },
    { "app": "Notes", "title": "Hackathon",  "bounds": { "x": 10,  "y": 10,  "width": 300, "height": 200 } }
  ],
  "screen": { "visibleFrame": { "x": 0, "y": 0, "width": 1728, "height": 1080 } },
  "trust": { "frontmostApp": "system", "windows": "untrusted" }   // window titles are user/app text
}`;

export const PLAN_2 = String.raw`{
  "v": 1, "type": "plan", "id": "plan_02", "intentId": "int_02",
  "source": "model",
  "reply": "Tiling your 3 Notes windows in a grid.",
  "actions": [
    { "id": "a1", "type": "tile", "layout": "grid", "windows": ["notes"] },
    { "id": "a2", "type": "say",  "text": "Done. Say 'undo' to put them back." }
  ]
}
// Geometry is computed by the launcher, not by the model. "notes" means every
// window of that app; the executor expands it using the Context windows list.`;

export const OSA_WINDOWS = String.raw`# Read bounds (needs Accessibility; property names unverified against an Apple page)
osascript -e 'tell application "System Events" to tell process "Notes" to return {position, size} of every window'

# Set bounds for window 1 of 3 in a 2x2 grid cell (computed by the launcher)
osascript <<'EOF'
tell application "System Events"
  tell process "Notes"
    set position of window 1 to {0, 0}
    set size of window 1 to {864, 540}
  end tell
end tell
EOF
# Before applying, the launcher snapshots the old bounds so "undo" can restore them.`;

export const RESULT_2 = String.raw`{
  "v": 1, "type": "result", "id": "res_02", "planId": "plan_02", "ok": true,
  "steps": [
    { "actionId": "a1", "status": "ok",
      "output": { "moved": 3, "undoToken": "undo_8841" } },
    { "actionId": "a2", "status": "ok" }
  ],
  "reply": "Done. Say 'undo' to put them back."
}`;

export const CLAUDE_CMD = String.raw`# Hand a coding/file task to Claude Code, headless, in a fixed project folder
cd ~/Projects/my-app            # working directory = the project the task is about

claude -p "$TASK" \
  --bare \
  --output-format stream-json --verbose --include-partial-messages \
  --permission-mode dontAsk \
  --allowedTools "Read,Edit,Bash(git status *),Bash(git diff *),Bash(npm test *)" \
  --disallowedTools "Bash(rm *),Bash(curl *)" \
  --max-turns 8 \
  --max-budget-usd 0.50 \
  --session-id "$(uuidgen | tr A-Z a-z)"`;

export const CLAUDE_STRUCTURED = String.raw`# Ask for a machine-readable summary instead of prose
claude -p "Summarize what changed in this repo today" \
  --bare --allowedTools "Read,Bash(git log *)" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}' \
  | jq '.structured_output'`;

export const CLAUDE_SDK = String.raw`// Alternative: embed the same agent loop in the launcher process (TypeScript)
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: task,
  options: { allowedTools: ["Read", "Glob"], permissionMode: "dontAsk" },
})) {
  if (message.type === "result") report(message);
}`;

export const REGISTRY = String.raw`// Capability registry: the single source of truth the planner, the policy gate
// and the executors all read. Web demo: src/deskhand/capabilities.js
{
  "browser.get_active_tab":  { "risk": "read_only",   "executor": "applescript" },
  "browser.list_tabs":       { "risk": "read_only",   "executor": "applescript" },
  "notes.append_link":       { "risk": "reversible",  "executor": "applescript" },
  "notion.append_bookmark":  { "risk": "reversible",  "executor": "http",        "needs": ["NOTION_TOKEN"] },
  "windows.tile":            { "risk": "reversible",  "executor": "system-events","needs": ["accessibility"] },
  "files.delete":            { "risk": "destructive", "executor": "claude-code", "confirm": "always" },
  "shell.claude_task":       { "risk": "destructive", "executor": "claude-code", "confirm": "always" }
}`;

export const HOTKEY_TAURI = String.raw`import { register } from "@tauri-apps/plugin-global-shortcut";

await register("CommandOrControl+Shift+Space", () => {
  showLauncherAndFocusInput();   // dictation app then types into this focused field
});`;
