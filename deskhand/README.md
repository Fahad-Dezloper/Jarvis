# Jarvis (web demo)

A macOS-style desktop in the browser that you control by voice. Dictate with Wispr Flow (hold Fn, speak) and Jarvis plans the steps and carries them out on screen: open apps, run commands, play music, change the wallpaper, edit widgets, search the real web and read pages.

See the repository root `README.md` for the full description, how it works and how to deploy, and the in-app `/docs` page for the protocol and the planned native launcher.

## Run

```bash
npm install
cp .env.example .env.local   # optional keys, see below
npm run dev
```

Keys are optional and read on the server only: `GOOGLE_GENERATIVE_AI_API_KEY` (or `ANTHROPIC_API_KEY`) for the AI planner; `SERPER_API_KEY` (real Google results) or `BRAVE_SEARCH_API_KEY` for web search. Without keys Jarvis falls back to offline rules and keyless web sources.

Checks: `npm run check:engine`, `check:apps`, `check:ui`, `check:web`, `check:system`.

## Credits

The desktop shell is forked from [kuldeeprajput-dev/macos-portfolio](https://github.com/kuldeeprajput-dev/macos-portfolio), MIT, (c) 2026 Kuldeep Rajput. The original license is kept in `LICENSE`. The personal content was removed; the voice engine, command capture, subtitles, missions, real-web search and reader, system controls and docs were added here.
