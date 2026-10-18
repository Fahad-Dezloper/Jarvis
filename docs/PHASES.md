# Build phases

Each phase ends with a passing `npm run build` and one commit pushed to `main`.
Shared contracts live in `lib/types.ts`.

| Phase | Goal | Main files |
|---|---|---|
| 0 | Foundation: deps, contracts, app shell, README | `lib/types.ts`, `app/` |
| 1 | Import + live preview + code editor (Sandpack) | `components/workbench/*`, `lib/sandbox/*` |
| 2 | Playback engine: discover, play, pause, seek, step, pick element | `lib/runtime/*`, `components/player/*` |
| 3 | Narration + pins tied to playhead time | `components/narration/*` |
| 4 | Prompt builder: API route, model call, heuristic fallback | `app/api/brief/*`, `lib/brief/*` |
| 5 | Send: copy, Cursor deeplink, Claude, `MOTION_BRIEF.md` | `components/send/*` |
| 6 | Video-recording fallback, polish, demo content, Vercel deploy | `components/recorder/*` |

Stretch: local MCP/CLI bridge that hands briefs straight to a repo.
