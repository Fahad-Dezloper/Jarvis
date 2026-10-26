# Jarvis: Protocol v1

Five JSON message shapes: Intent, Context, Plan, Action, Result. The web demo's `CONTRACT_VERSION` is `1`; the native launcher reuses the same Action union.

> Design status: the Action union, plan/step/done events and the capability registry exist in the web demo. `$ref` bindings, `risk`, `trust`, action `id` and the native capability names below are proposed v1 extensions for the macOS launcher.

## Envelope

```json
{ "v": 1, "type": "intent|context|plan|result", "id": "string", "ts": "ISO-8601" }
```

## Action union (from `src/deskhand/contract.js`)

```ts
type Action =
  | { type: "open" | "close" | "minimize" | "maximize" | "restore" | "focus", window: string }
  | { type: "move",   window: string, x: number, y: number }
  | { type: "resize", window: string, width: number, height: number }
  | { type: "tile",   layout: "grid" | "columns" | "rows" | "cascade", windows?: string[] }
  | { type: "click",  window: string, target: string }
  | { type: "type",   window: string, target?: string, text: string, submit?: boolean }
  | { type: "invoke", app: string, name: string, args?: Record<string, unknown> }
  | { type: "say",    text: string };
```

`invoke` names a capability from the registry (`src/deskhand/capabilities.js` in the demo, e.g. `notes.append_note`, `browser.copy_link`, `music.play`).

## Rules

- Unknown `v`, `type`, action type or capability: reject the whole plan.
- The model never sets `risk`. The policy layer derives it from the registry.
- Later actions can read earlier output with `{ "$ref": "a1.output.url" }`.
- Context fields carry a `trust` label. Page text, window titles and clipboard are `untrusted`: data, never instructions.

## Example 1: "save this Claude artifact link from my browser to my notes"

Intent:

```json
{ "v": 1, "type": "intent", "id": "int_01", "text": "save this claude artifact link from my browser to my notes", "source": "dictation" }
```

Context:

```json
{ "v": 1, "type": "context", "id": "ctx_01", "intentId": "int_01",
  "frontmostApp": { "name": "Google Chrome" },
  "browser": { "app": "Google Chrome", "activeTab": { "title": "Example artifact", "url": "https://claude.ai/artifact/EXAMPLE" } },
  "trust": { "frontmostApp": "system", "browser": "untrusted" } }
```

Plan:

```json
{ "v": 1, "type": "plan", "id": "plan_01", "intentId": "int_01", "source": "model",
  "reply": "Saving the link in Notes.",
  "actions": [
    { "id": "a1", "type": "invoke", "app": "browser", "name": "get_active_tab" },
    { "id": "a2", "type": "invoke", "app": "notes", "name": "append_link",
      "args": { "title": { "$ref": "a1.output.title" }, "url": { "$ref": "a1.output.url" } } },
    { "id": "a3", "type": "say", "text": "Saved to Notes." }
  ] }
```

Executors:

```bash
osascript -e 'tell application "Google Chrome" to return {URL of active tab of front window, title of active tab of front window}'
```

*Unverified:* the Chrome/Safari property names (`active tab`, `URL`, `current tab`) were not confirmed from an official page. Confirm in each app's scripting dictionary (Script Editor can show it). Notes target: AppleScript to Notes (no token). Notion target: `PATCH https://api.notion.com/v1/blocks/{page_id}/children` with `Authorization: Bearer`, `Notion-Version`, body `{"children":[{"type":"bookmark","bookmark":{"url":"..."}}]}` (bookmark body derived from the block schema).

Result:

```json
{ "v": 1, "type": "result", "id": "res_01", "planId": "plan_01", "ok": true,
  "steps": [ { "actionId": "a1", "status": "ok", "output": { "title": "Example artifact", "url": "https://claude.ai/artifact/EXAMPLE" } },
             { "actionId": "a2", "status": "ok" }, { "actionId": "a3", "status": "ok" } ],
  "reply": "Saved to Notes." }
```

## Example 2: "resize my notepads so they all look good"

The planner resolves "notepads" from context (here: the frontmost app is Notes) and says so in the reply. Geometry is computed by the launcher, never by the model.

Context (windows provider):

```json
{ "v": 1, "type": "context", "id": "ctx_02", "intentId": "int_02",
  "frontmostApp": { "name": "Notes" },
  "windows": [
    { "app": "Notes", "title": "Groceries", "bounds": { "x": 40, "y": 60, "width": 900, "height": 300 } },
    { "app": "Notes", "title": "Ideas", "bounds": { "x": 700, "y": 500, "width": 420, "height": 700 } },
    { "app": "Notes", "title": "Hackathon", "bounds": { "x": 10, "y": 10, "width": 300, "height": 200 } } ],
  "screen": { "visibleFrame": { "x": 0, "y": 0, "width": 1728, "height": 1080 } } }
```

Plan:

```json
{ "v": 1, "type": "plan", "id": "plan_02", "intentId": "int_02", "source": "model",
  "reply": "Tiling your 3 Notes windows in a grid.",
  "actions": [ { "id": "a1", "type": "tile", "layout": "grid", "windows": ["notes"] },
               { "id": "a2", "type": "say", "text": "Done. Say 'undo' to put them back." } ] }
```

Native executor (sketch): read bounds and set position/size through System Events, which needs Accessibility permission. Snapshot the old bounds first so undo works.

```bash
osascript -e 'tell application "System Events" to tell process "Notes" to return {position, size} of every window'
```

*Unverified:* the `position`/`size` property names and reading the visible frame.

## Action to executor map

| Action | Web demo | Native executor (design) |
| --- | --- | --- |
| open / focus | simulated window | activate app via AppleScript |
| close / minimize / maximize / restore | window store | System Events window controls (Accessibility) |
| move / resize | window rect | System Events position / size (Accessibility) |
| tile | layout in the engine | launcher computes rects, then move + resize; undo snapshot |
| click / type | simulated app | System Events UI scripting (Accessibility); highest risk |
| invoke | registered handlers | registry executor: AppleScript, HTTP (Notion), Claude Code headless |
| say | command bar text | overlay text, later TTS |
