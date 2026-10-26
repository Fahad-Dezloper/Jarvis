# Jarvis demo script (about 2 minutes)

Goal: show that you only speak, Wispr Flow turns it into text, and Jarvis does real work on a Mac-style desktop. Keep the Wispr Flow bar visible in the recording so the judges see Fn being used.

## Before you record
- Use a production build for fast, reliable dictation: in `deskhand`, `npm run build` then `npm start` (port 3000). Dev mode is slower and can make Wispr's paste arrive empty.
- Put your keys in `.env.local` first (Gemini or Anthropic for the AI; Serper for real Google search).
- Wispr Flow: push-to-talk (hold Fn), not hands-free. Pick a quiet room.
- Run each command once before recording so everything is warm, then reload and start clean.
- Screen recording: Cmd+Shift+5, record the browser window plus microphone. Full screen (F11) looks best.
- Music needs one click on the page first (browsers block sound until you interact).

## Script

**0:00 - Intro (talk to camera; the lock screen writes "wispr").**
> "Everything you're about to see, I do without touching the keyboard or the mouse. This is Jarvis: a Mac desktop in your browser that you run with your voice. And the voice part is Wispr Flow."

Press Enter.

**0:12 - Claude Code.** Hold Fn and say:
> "Open Claude Code, open the project folder, read everything and tell me what it is about."

Shows: terminal opens, reads the files with checkmarks, the subtitle gives a plain-English summary.

**0:35 - The real web.**
> "Open Chrome, search for Paradigm research papers and open the latest one."

Shows: real results, then the article in reader view.

**1:00 - Control the whole desktop (do this BEFORE the tiling command so the change is visible).**
> "Change the wallpaper to violet waves, add a weather widget to the top left, and take a screenshot."

Shows: the wallpaper cross-fades, a weather widget appears, a screenshot thumbnail pops up.

**1:20 - The big one (many apps in one breath).**
> "Open the calendar and add lunch with Priya tomorrow at one pm, open the calculator and compute eighteen percent of two thousand four hundred fifty, open notes and write buy milk, play the HiNV playlist, and then tile all the windows."

Shows: five apps open, each does its job, then the windows snap into a grid. Say "show me the desktop" afterwards if you want the new wallpaper back in frame.

**1:38 - Ending (talk to camera, open `/docs`).**
> "Wispr Flow did one job here, and it did it perfectly: it got my words to Jarvis. Jarvis does the rest. Wispr is the voice, the web is the hands. Next is a native launcher that does this on your real Mac, and the protocol for it is documented right here. No hands. Just Wispr."

## If something goes wrong
- A command stalls: say "stop", or press Esc, then repeat it shorter.
- AI quota hit: the offline rules still do common commands. Shorten the long command to two or three parts.
- Cut dead time in editing: AI planning takes 3 to 10 seconds per step, so trim the waits.

## Submission checklist
- Project link (no sign-in) and a video of up to 2 minutes.
- Usage card screenshot: Wispr Flow desktop app, Insights, Your usage, Share.
- A short clip of Flow in use, and a few lines on the problem, the user and how Wispr was used.
- Post with #NoHandsChallenge, tag WeMakeDevs and Wispr Flow.
