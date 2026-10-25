# Deskhand: Claude Code bridge

For tasks that touch files or a codebase, the launcher runs Claude Code non-interactively with a scoped tool set and streams progress back.

```bash
cd ~/Projects/my-app
claude -p "$TASK" \
  --bare \
  --output-format stream-json --verbose --include-partial-messages \
  --permission-mode dontAsk \
  --allowedTools "Read,Edit,Bash(git status *),Bash(git diff *),Bash(npm test *)" \
  --disallowedTools "Bash(rm *),Bash(curl *)" \
  --max-turns 8 --max-budget-usd 0.50 \
  --session-id "$(uuidgen | tr A-Z a-z)"
```

## Verified flags and behaviour

Source: https://code.claude.com/docs/en/headless and https://code.claude.com/docs/en/cli-reference

- `-p` / `--print`: non-interactive. Exit code 0 on success, non-zero on failure.
- `--output-format`: `text` (default), `json`, `stream-json`. Streaming needs `--verbose --include-partial-messages` for token deltas; the last line is a `result` message.
- `--json-schema`: validated output in the `structured_output` field (check it exists).
- `--allowedTools`: permission-rule syntax; `Bash(git diff *)` is prefix matching and the space before `*` matters.
- `--disallowedTools`: deny rules; scoped rules like `Bash(rm *)` deny only matching calls.
- `--permission-mode`: `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` (and `manual` as an alias for `default`). `dontAsk` denies anything that would prompt. `bypassPermissions` is for isolated environments only.
- `--permission-prompts none`: deny prompts when nobody can answer (Claude Code v2.1.259 or later).
- `--max-turns`, `--max-budget-usd`: print-mode caps (budget is a client-side estimate).
- `--session-id <uuid>`, `--resume <id>`, `--continue`: session handling. `--output-format json` returns `session_id`.
- `--bare`: skips hooks, skills, plugins, MCP servers, auto memory, CLAUDE.md; uses `ANTHROPIC_API_KEY`, not subscription login.
- `--mcp-config`, `--strict-mcp-config`: choose MCP servers explicitly. `--add-dir`: extra readable/editable directories.
- Piped stdin is capped at 10 MB. SIGINT ends the turn; SIGTERM exits with code 143 and records no result for the turn in progress.

## Operating rules

1. Working directory is the project the task is about, never the home folder.
2. Start read-only; add `Edit` or specific `Bash(...)` patterns per task.
3. The launcher owns the wall-clock timeout: SIGINT first, then SIGTERM.
4. Never paste page or clipboard text into the prompt as instructions. Write it to a file and reference it as data.
5. Every run is recorded in the audit log with flags, session id and cost.

## Alternative: Claude Agent SDK

Same agent loop as a library: `@anthropic-ai/claude-agent-sdk` (TypeScript) and `claude-agent-sdk` (Python). Options include `allowedTools` and `permissionMode`, and it supports hooks, MCP and sessions. Source: https://code.claude.com/docs/en/agent-sdk/overview and /quickstart.

Authentication note (verified): Anthropic does not allow third-party developers to offer claude.ai login or its rate limits in their products unless previously approved. Use API key auth or a supported cloud provider.
