// Module-level 'mail' handlers: they open the Mail window themselves and drive
// the shared store, so they work whether or not the window is already open.
import useWindowsStore from "@store/window";
import "../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import useMailStore from "./mailStore";
import { isValidRecipient, resolveRecipient } from "./mailCore";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeInto(field, text) {
  const store = useMailStore.getState();
  const value = String(text || "");
  if (!value) return;
  // Keep the whole animation short: faster per-character for long bodies.
  const step = Math.max(6, Math.min(28, Math.floor(1800 / value.length)));
  for (let i = 1; i <= value.length; i++) {
    store.patchCompose({ [field]: value.slice(0, i) });
    await sleep(step);
  }
}

const handlers = {
  compose: async (args) => {
    try {
      const raw = String(args?.to ?? "").trim();
      if (!raw) return { ok: false, message: "No recipient was given." };
      const to = resolveRecipient(raw, useMailStore.getState().inbox);
      const subject = String(args?.subject ?? "");
      const body = String(args?.body ?? "");
      useWindowsStore.getState().openWindow("mail");
      await sleep(350);
      const store = useMailStore.getState();
      store.openCompose({ typing: true });
      await typeInto("to", to);
      await typeInto("subject", subject);
      await typeInto("body", body);
      useMailStore.getState().patchCompose({ typing: false });
      const note = isValidRecipient(to) ? "" : ` Note: "${to}" is not a full email address.`;
      return {
        ok: true,
        message: `Composing a new email to ${to}${subject ? ` with subject "${subject}"` : ""} (simulated mail).${note}`,
        data: `To: ${to}\nSubject: ${subject}\n\n${body}`.slice(0, 2000),
      };
    } catch (err) {
      return { ok: false, message: `Mail error: ${err?.message || err}` };
    }
  },
  send: async () => {
    try {
      const c = useMailStore.getState().compose;
      if (!c) return { ok: false, message: "There is no email being composed. Compose one first." };
      if (!c.to.trim()) return { ok: false, message: "The email has no recipient yet." };
      await sleep(300);
      const msg = useMailStore.getState().send();
      return {
        ok: true,
        message: `Sent the email to ${msg.to} (simulated; nothing left this browser).`,
        data: `Sent: ${msg.subject}`,
      };
    } catch (err) {
      return { ok: false, message: `Mail error: ${err?.message || err}` };
    }
  },
};

if (typeof window !== "undefined") {
  registerHandlers("mail", handlers);
  registerSummary("mail", () => {
    const s = useMailStore.getState();
    const c = s.compose;
    const inbox = s.inbox
      .slice(0, 6)
      .map((m) => `${m.from}: ${m.subject}`)
      .join("; ");
    return `Simulated Mail. Inbox (${s.inbox.length}): ${inbox}. Sent: ${s.sent.length}. ${c ? `Composing to "${c.to}" subject "${c.subject}".` : "Not composing."}`;
  });
}
