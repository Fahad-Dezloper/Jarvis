# Motion Brief

Narrate an animation, pin your words to the exact frame, and get a precise prompt for your AI coding agent.

Built for the WeMakeDevs x Wispr Flow "No Hands" challenge (Builders track). Non-commercial.

## The problem

Explaining motion to an AI agent in text is hard: what happens before this frame, at this frame, after it. Speaking is faster and richer than typing, but a raw ramble has no structure and no timestamps.

## How it works

1. **Import** a React component, HTML, SVG or CSS (paste, drop files, or a GitHub file URL), or start from a sample. It runs live in the browser.
2. **Scrub** the animation: play, pause, step frame by frame, slow down, pick an element.
3. **Narrate** into one big box (made for dictation). Pins are logged against the playhead time and the picked element.
4. **Build the brief.** The notes, code and measured animation values become a structured prompt. A model writes it when a key is configured; otherwise a rule-based fallback does.
5. **Send** it: copy, open in Cursor, open in Claude Code, or download `MOTION_BRIEF.md`.

For animations that cannot be scrubbed (JavaScript-driven, canvas), annotate a screen recording frame by frame instead.

## Scrubbing support

| Technology | Seek / step |
|---|---|
| CSS animations and transitions, Web Animations API | Yes |
| GSAP (top-level tweens) | Yes |
| SVG SMIL | Yes |
| Other JS-driven animation | Use the video recorder instead |

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev
```

Without a key the brief is built by the offline heuristic. Checks: `npm run check:brief`, `check:send`, `check:narration`, `check:recorder`.

Phases and status: [docs/PHASES.md](docs/PHASES.md).

## Credits and licenses

- **Deskhand base (`deskhand/`):** forked from [kuldeeprajput-dev/macos-portfolio](https://github.com/kuldeeprajput-dev/macos-portfolio), MIT, (c) 2026 Kuldeep Rajput. The original license is kept at `deskhand/LICENSE`. Personal content is being replaced and a voice action engine added.
- In-browser preview: [Sandpack](https://github.com/codesandbox/sandpack) by CodeSandbox, Apache-2.0.
- [Motion](https://github.com/motiondivision/motion), MIT, (c) 2024 Motion B.V. (used inside sample animations).
- [GSAP](https://gsap.com), used under the [GSAP Standard License](https://gsap.com/standard-license/) as a library inside sample animations. Not redistributed or modified.
- Scrubber and pause/seek design informed by the Chrome DevTools Animations panel (BSD-3-Clause, The Chromium Authors). Technique only, no code copied.
- Annotation-to-agent-prompt idea inspired by [Agentation](https://github.com/benjitaylor/agentation) (PolyForm Shield 1.0.0). No code reused.
- Built with Next.js, React, Tailwind CSS, the Vercel AI SDK, zod, lucide-react.
