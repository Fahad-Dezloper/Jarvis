# Deskhand: Roadmap

| Stage | Scope | Status |
| --- | --- | --- |
| V1 | Web demo on a simulated desktop; real voice-text-model-action loop and action schema | Live |
| V1.1 | macOS menu-bar launcher, global hotkey, context providers (app, tabs, clipboard, windows), AppleScript and Claude Code executors, policy gate, audit log | Coming soon |
| V2 | Voice replies (TTS), memory of preferences, more executors (Notion and others), Windows and Linux | Planned |

No dates: V1.1 and V2 are plans, not promises. Anything marked design or unverified is validated on real hardware before it ships.

## Launcher shell and hotkey options

| Option | Global hotkey | Notes |
| --- | --- | --- |
| Tauri v2 | `@tauri-apps/plugin-global-shortcut` (crate `tauri-plugin-global-shortcut`) | commands blocked until allowed in a capability file |
| Electron | `globalShortcut.register(accelerator, callback)` | main process, after `ready`; silently fails if taken |
| Hammerspoon | `hs.hotkey.bind(mods, key, pressedfn, ...)` | Lua; quick prototype |
| Swift menu-bar app | native | not researched (unverified) |

## Dictation (Wispr Flow) facts

Verified from https://docs.wisprflow.ai : "Flow types for you in any app"; Mac and Windows downloads; Mac defaults Fn (push to talk), Fn+Space (hands-free), Fn+Ctrl (Command Mode). No developer API/SDK was found in the pages read; how text is inserted is not documented there. Deskhand assumes only a focused text field and claims no official integration.
