# Orry: Architecture

```
Dictation (user's app, e.g. Wispr Flow)
   -> Launcher input (focused text field)
   -> Context providers (frontmost app, browser tabs, clipboard, windows)
   -> Planner (model, structured output)  -> Plan (JSON, validated)
   -> Policy + consent gate (risk tier, allowlist, preview)
   -> Executors: AppleScript | Claude Code headless | app APIs (Notion, ...)
   -> Result + feedback (text, audio, overlay)
   +  Audit log (local, append-only)        Kill switch halts gate + executors
```

The same picture is drawn as an SVG on the `/docs` page.

Principles:

- The model sees only the planner step. It holds no credentials and runs nothing.
- Executors are small, do one kind of thing, and validate their inputs.
- One capability registry feeds the planner prompt, the policy gate and the executors.
