# Jarvis: Security model

Assume the model can be wrong and any text it reads can be hostile.

## Risk tiers

| Tier | Examples | Policy |
| --- | --- | --- |
| read_only | get active tab, list windows | run without asking; logged |
| reversible | append to a note, tile windows, set volume | preview chip; confirm on first use per target; undo where possible |
| destructive | delete files, send messages, shell, Claude Code with Edit/Bash | always confirm with a dry-run preview; never remembered |

## Controls

- **Allowlists:** only registry capabilities exist; explicit `--allowedTools` for Claude Code; Notion writes only to pages shared with the integration.
- **Dry-run preview** for everything above read_only.
- **No secrets in prompts:** tokens live in the keychain/environment of the executor; clipboard text that looks like a key is withheld.
- **Local-first context:** providers run on the device; only needed fields go to the model; `$ref` keeps raw values out.
- **Audit log:** append-only local file of intent, plan, approvals, results.
- **Kill switch:** global hotkey and menu item cancel the plan, stop child processes and disable executors.

## Prompt injection

Page titles, URLs, window titles, notes and clipboard are **data, never instructions**: labeled `untrusted`, wrapped as quoted data in the planner prompt, plans must validate against the schema, risk is set by the registry, destructive steps need a human click. These layers reduce the risk; they do not eliminate it.

## macOS permissions (verified)

System Settings > Privacy & Security has Automation, Accessibility, Screen & System Audio Recording and Input Monitoring panes (https://support.apple.com/guide/mac-help/control-access-to-your-mac-mchl211c911f/mac). Accessibility control is off by default and enabled per app; admin credentials are required (https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/AutomatetheUserInterface.html). The exact Automation consent prompt behaviour was not confirmed from an official page (unverified).

## Not done in V1

- No control of your real computer (the demo desktop is simulated).
- No native policy gate, audit log or kill switch (design only).
- No token storage, clipboard access, Notion or Notes access.
