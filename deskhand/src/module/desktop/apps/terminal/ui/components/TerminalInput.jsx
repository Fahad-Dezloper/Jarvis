import { useEffect } from "react";
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import useWindowsStore from "@store/window";
import "../../../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import {
  createSession,
  interpret,
  promptText,
  welcomeEvents,
  eventsToText,
  PROJECT,
  pathsFromRequest,
} from "../../interpreter";
import { PROJECT_SUMMARY, PROJECT_NAME, projectDigest } from "../../../shared/orbitTodoProject";

const TYPE_DELAY_MS = 12;

const TerminalInput = ({ terminalRef, xtermRef, fitAddonRef, commandRef }) => {
  const isOpen = useWindowsStore((state) => state.windows.terminal?.isOpen);

  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

    let term = null;
    let fitAddon = null;
    let isOpened = false;
    let disposed = false;

    const session = createSession();
    const state = {
      busy: false,
      serving: false,
      token: 0,
      history: [],
      histIdx: -1,
      lastCommand: "",
      chain: Promise.resolve(),
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const prompt = () => term && term.write(promptText(session));

    // Prints events one by one. Resolves false if cancelled (Ctrl+C / unmount).
    const play = async (events, token) => {
      for (const e of events) {
        if (disposed || token !== state.token) return false;
        if (e.delay) await sleep(e.delay);
        if (disposed || token !== state.token) return false;
        if (e.clear) term.write("\x1b[2J\x1b[3J\x1b[H");
        else term.write(e.text + "\r\n");
      }
      return true;
    };

    // Runs a command line that is already echoed on screen.
    const submit = async (cmd) => {
      const trimmed = cmd.trim();
      commandRef.current = "";
      state.histIdx = -1;
      if (!trimmed) {
        term.write("\r\n");
        prompt();
        return { text: "", serving: false };
      }
      state.history.push(trimmed);
      state.lastCommand = trimmed;
      term.write("\r\n");
      state.busy = true;
      const token = ++state.token;
      let result;
      try {
        result = interpret(trimmed, session);
      } catch (err) {
        result = { events: [{ text: `error: ${err?.message || err}`, delay: 0 }], serve: false };
      }
      const completed = await play(result.events, token);
      if (disposed) return { text: "", serving: false };
      if (!completed) return { text: eventsToText(result.events), serving: false };
      state.busy = false;
      if (result.serve) {
        state.serving = true;
      } else {
        prompt();
      }
      return { text: eventsToText(result.events), serving: !!result.serve };
    };

    const interrupt = () => {
      state.token++;
      state.busy = false;
      state.serving = false;
      commandRef.current = "";
      term.write("^C\r\n");
      prompt();
    };

    const setLine = (text) => {
      const cur = commandRef.current;
      if (cur.length) term.write("\b \b".repeat(cur.length));
      commandRef.current = text;
      if (text) term.write(text);
    };

    const whenReady = async () => {
      for (let i = 0; i < 80 && !disposed; i++) {
        if (isOpened && term) return true;
        await sleep(50);
      }
      return false;
    };

    const typeAndRun = async (command) => {
      if (!(await whenReady())) {
        return { ok: false, message: "The terminal is not ready yet." };
      }
      if (state.serving) interrupt();
      for (let i = 0; i < 100 && state.busy && !disposed; i++) await sleep(100);
      if (disposed) return { ok: false, message: "The terminal was closed." };
      setLine("");
      for (const ch of command) {
        if (disposed) return { ok: false, message: "The terminal was closed." };
        term.write(ch);
        commandRef.current += ch;
        await sleep(TYPE_DELAY_MS);
      }
      await sleep(120);
      const { text, serving } = await submit(commandRef.current);
      const tail = text.split("\n").filter(Boolean).slice(-6).join(" | ").slice(0, 320);
      return {
        ok: true,
        message: `Ran "${command}" in the terminal${serving ? " (the dev server keeps running)" : ""}.${tail ? ` Output: ${tail}` : ""}`,
      };
    };

    const queue = (fn) => {
      const p = state.chain.then(fn, fn);
      state.chain = p.then(
        () => undefined,
        () => undefined,
      );
      return p;
    };

    const unregister = registerHandlers("terminal", {
      run_command: async (args) => {
        try {
          const command = String(args?.command ?? "").trim();
          if (!command) return { ok: false, message: "No command given." };
          return await queue(() => typeAndRun(command));
        } catch (err) {
          return { ok: false, message: `Terminal error: ${err?.message || err}` };
        }
      },
      read_project: async (args) => {
        try {
          const path = String(args?.path ?? "").trim();
          const only = path ? pathsFromRequest(path) : [];
          if (path && !only.length) {
            return {
              ok: false,
              message: `There is no file or folder called "${path}" in ${PROJECT_NAME}.`,
            };
          }
          const run = await queue(async () => {
            if (!session.cwd.startsWith(PROJECT)) {
              const cd = await typeAndRun("cd orbit-todo");
              if (!cd.ok) return cd;
            }
            return typeAndRun(path ? `claude read ${path}` : "claude explain this project");
          });
          if (!run.ok) return run;
          const digest = projectDigest({ maxChars: 4800, only: only.length ? only : undefined });
          const data = only.length
            ? digest.text
            : `${digest.text}\nSummary:\n${PROJECT_SUMMARY.map((l) => `- ${l}`).join("\n")}`;
          return {
            ok: true,
            message: `Read ${only.length || digest.files.length} files of ${PROJECT_NAME} in the terminal and summarised them.`,
            data: data.slice(0, 6000),
          };
        } catch (err) {
          return { ok: false, message: `Terminal error: ${err?.message || err}` };
        }
      },
      clear: async () => {
        try {
          if (!(await whenReady())) return { ok: false, message: "The terminal is not ready yet." };
          return await queue(async () => {
            if (state.serving) interrupt();
            state.token++;
            state.busy = false;
            term.write("\x1b[2J\x1b[3J\x1b[H");
            commandRef.current = "";
            prompt();
            return { ok: true, message: "Cleared the terminal." };
          });
        } catch (err) {
          return { ok: false, message: `Terminal error: ${err?.message || err}` };
        }
      },
    });
    const unregisterSummary = registerSummary("terminal", () =>
      state.serving
        ? `Terminal is running a dev server (last command: ${state.lastCommand}). Working dir ${session.cwd}.`
        : state.lastCommand
          ? `Terminal idle at ${session.cwd}; last command: ${state.lastCommand}.`
          : `Terminal idle at ${session.cwd}; no commands run yet.`,
    );

    const setupHandlers = (t) => {
      for (const e of welcomeEvents(session)) t.write(e.text + "\r\n");
      t.write("\r\n");
      prompt();

      t.onData((data) => {
        if (state.serving) {
          if (data.includes("\x03")) interrupt();
          return;
        }
        if (state.busy) {
          if (data.includes("\x03")) interrupt();
          return;
        }

        if (data.length > 1 && !data.startsWith("\x1b")) {
          // Pasted text: take printable characters only (first line).
          const first = data.split(/\r|\n/)[0];
          for (const ch of first) {
            const code = ch.charCodeAt(0);
            if (code >= 32 && code !== 127) {
              commandRef.current += ch;
              t.write(ch);
            }
          }
          if (/[\r\n]/.test(data)) submit(commandRef.current);
          return;
        }

        if (data === "\x1b[A") {
          if (state.history.length === 0) return;
          state.histIdx =
            state.histIdx === -1 ? state.history.length - 1 : Math.max(0, state.histIdx - 1);
          setLine(state.history[state.histIdx]);
          return;
        }
        if (data === "\x1b[B") {
          if (state.histIdx === -1) return;
          state.histIdx++;
          if (state.histIdx >= state.history.length) {
            state.histIdx = -1;
            setLine("");
          } else {
            setLine(state.history[state.histIdx]);
          }
          return;
        }

        const code = data.charCodeAt(0);
        if (code === 13) {
          submit(commandRef.current);
        } else if (code === 3) {
          interrupt();
        } else if (code === 127 || code === 8) {
          if (commandRef.current.length > 0) {
            commandRef.current = commandRef.current.slice(0, -1);
            t.write("\b \b");
          }
        } else if (code >= 32 && code <= 126) {
          commandRef.current += data;
          t.write(data);
        }
      });
    };

    const tryInit = () => {
      if (isOpened || !terminalRef.current) return;
      const { width, height } = terminalRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        term = new XTerm({
          cursorBlink: true,
          fontFamily: "Menlo, Monaco, 'Courier New', monospace",
          fontSize: 14,
          lineHeight: 1.4,
          theme: {
            background: "#ffffff",
            foreground: "#333333",
            cursor: "#333333",
            selectionBackground: "#b5d5ff",
          },
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        isOpened = true;

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        try {
          fitAddon.fit();
        } catch (e) {
          console.warn("Could not fit terminal on lazy open:", e);
        }

        commandRef.current = "";
        setupHandlers(term);
      }
    };

    tryInit();

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) return;
      }
      if (!isOpened) {
        tryInit();
      } else if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          /* empty */
        }
      }
    });

    resizeObserver.observe(terminalRef.current);

    const timer = setTimeout(() => {
      if (!isOpened) {
        tryInit();
      } else if (fitAddonRef.current && terminalRef.current) {
        const { width, height } = terminalRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          try {
            fitAddonRef.current.fit();
          } catch {
            /* empty */
          }
        }
      }
    }, 150);

    return () => {
      disposed = true;
      state.token++;
      unregister();
      unregisterSummary();
      clearTimeout(timer);
      resizeObserver.disconnect();
      if (term) {
        term.dispose();
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isOpen, commandRef, fitAddonRef, terminalRef, xtermRef]);

  return (
    <div
      ref={terminalRef}
      className="flex-1 w-full bg-white pt-4 px-4 pb-12 outline-none xterm-wrapper"
      style={{ overflow: "hidden" }}
    />
  );
};

export default TerminalInput;
