# Jarvis

**Say what you want. Your desktop does it.**

Jarvis is a voice-first desktop. You hold your dictation key ([Wispr Flow](https://wisprflow.ai)), speak loosely, and a model turns what you meant into actions that happen on screen: open apps, run commands, play music, save a link, tidy your windows.

Built for the WeMakeDevs x Wispr Flow "No Hands" challenge (Builders track). Non-commercial.

## Two parts

| | What it is | Status |
|---|---|---|
| **Jarvis web demo** (`deskhand/`) | A macOS-style desktop in the browser that you control by voice. Open the link, no sign-in, no install. | Working. This is the submission. |
| **Jarvis launcher** (design only) | A small always-on command bar for your real computer. Same idea, real apps. | Planned. The protocol and infrastructure are documented at `/docs`. |

## Try it

1. Open the demo and press Enter on the lock screen.
2. Click into the bar at the bottom (it stays focused), hold your Wispr Flow key and speak. Typing works too.
3. Follow the **Try it with your voice** card:
   - "Open Claude Code"
   - "Run npm run dev"
   - "Close it"
   - "Open Spotify"
   - "Play the HiNV Music playlist"

Bonus: "Open the browser and save this artifact link to my notes", "Resize the windows so they all look good", "Switch to dark mode".

Jarvis understands messy, dictated speech ("uh open claude code and then run npm run dev"), and follow-ups like "close it" use the previous turn.

## How it works

```
Wispr Flow  ->  command bar  ->  snapshot of the desktop  ->  planner  ->  executor  ->  visible result
(dictation)     (focused text     (windows, app state,         (model, or    (store,       (action log,
                 field)            clickable elements)          offline       app           virtual cursor,
                                                                rules)        handlers,     missions)
                                                                              DOM)
```

- **Wispr Flow only types text into whichever field has focus.** Jarvis has no speech code of its own. The app adds the structure: it reads the desktop, plans a short sequence of actions, and shows each step.
- **Planner:** Claude or Gemini through the Vercel AI SDK with structured output, validated against an allowlist of actions. With no API key (or if the model fails) an offline rules parser handles common commands, so the demo always works.
- **Executor:** window actions go through the desktop store; apps expose handlers (terminal, notes, browser, music, settings, finder); any other app can still be clicked and typed into through a generic scan of on-screen controls.
- **Safety:** model output is validated against a fixed set of actions. Page and app text is treated as data, never as instructions.

### What is real and what is simulated in the web demo

| Real | Simulated |
|---|---|
| Voice text -> model -> action loop and its action schema | The Claude Code terminal (a scripted look-alike) |
| Window management, tiling, clicking and typing | The browser pages (mock Claude artifact, news list, repo page) |
| Music playback (Jamendo tracks, with generated audio as the offline fallback) | Notes, Finder and Settings data |

## Documentation

`/docs` in the app (also in [`deskhand/docs/`](deskhand/docs)) covers the V1 vision, architecture, the message protocol, how a native launcher would hand tasks to Claude Code headless, context providers (current browser tab, Notes, Notion), the security model and the roadmap. Facts were checked against official docs and anything unverified is labelled.

## Run it

```bash
cd deskhand
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev
```

Without a key, Jarvis uses the offline rules planner. The key is read on the server only.

Checks: `npm run check:engine`, `check:apps`, `check:ui`.

### Deploy on Vercel

Import the repository, set **Root Directory** to `deskhand`, and add either `ANTHROPIC_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`, plus `SERPER_API_KEY` for real Google results (and optionally `DESKHAND_PROVIDER` or `DESKHAND_MODEL`) as environment variables. Keep the key server-side and put a spending limit on it.

## Also in this repo: Motion Brief

An earlier experiment, still working at `/motion-brief` in the root app (tagged `motion-brief-v1`): import a component with an animation, scrub it, pin dictated notes to exact frames, and get a precise prompt for an AI coding agent. See [docs/PHASES.md](docs/PHASES.md).

## Credits and licenses

- **Desktop base:** forked from [kuldeeprajput-dev/macos-portfolio](https://github.com/kuldeeprajput-dev/macos-portfolio), MIT, (c) 2026 Kuldeep Rajput. The original license is kept at `deskhand/LICENSE`. Personal content was removed and a voice action engine, command bar, missions and docs were added.
- Music from [Jamendo](https://www.jamendo.com) through its public API.
- Window animation with [GSAP](https://gsap.com), used under the [GSAP Standard License](https://gsap.com/standard-license/).
- Motion Brief only: [Sandpack](https://github.com/codesandbox/sandpack) (CodeSandbox, Apache-2.0); [Motion](https://github.com/motiondivision/motion) (MIT); scrubber design informed by the Chrome DevTools Animations panel (BSD-3-Clause, technique only); annotation idea inspired by [Agentation](https://github.com/benjitaylor/agentation) (PolyForm Shield 1.0.0, no code reused).
- Built with Next.js, React, Tailwind CSS, Zustand, the Vercel AI SDK, zod and lucide-react.
