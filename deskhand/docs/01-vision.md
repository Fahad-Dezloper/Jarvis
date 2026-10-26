# Jarvis: Vision

Jarvis is a voice-first desktop launcher. You hold your dictation key, speak loosely, and a model plans and performs actions on your computer.

## Why

- People have wanted a Jarvis for a long time.
- Built-in assistants are good at one-shot questions and single-app commands. Multi-step control that crosses apps (read what is in my browser, file it in my notes) is where there is more room to grow.
- Dictation is now accurate enough that speaking loosely works: half sentences, corrections, filler words.
- A model is good at turning loose language into structure.

**Idea in one line: loose speech to structured intent to safe actions.**

## What is real in V1 and what is simulated

The website is **V1, a browser demo on a simulated desktop**. The real launcher (macOS first) is **coming soon**.

| Piece | Status in the web demo |
| --- | --- |
| Voice to text | Real flow: text arrives in a focused input (any dictation app or keyboard). |
| Text to model | Real: the command bar asks a model for a plan, with an offline rule-based fallback. |
| Action schema | Real: `src/deskhand/contract.js` and `capabilities.js`. |
| Apps and windows | Simulated React components, not your real apps. |
| macOS control | Not built: AppleScript, System Events, Claude Code and Notion executors are design only. |

Jarvis does not claim any official integration with Wispr Flow or another dictation product. It only needs a focused text field.
