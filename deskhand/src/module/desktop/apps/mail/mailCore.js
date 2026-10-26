// Pure helpers for the simulated Mail app. No alias imports.

export const INBOX_SEED = [
  {
    id: "m1",
    from: "Priya Nair",
    address: "priya@northwind.example",
    subject: "Quarterly planning notes",
    date: "2026-10-26T08:12:00",
    body: "Hi,\n\nThanks for joining yesterday's planning call. I put the notes in the shared folder. The main open item is the launch checklist: we still need an owner for the docs review.\n\nCan you take a look when you have a moment?\n\nPriya",
  },
  {
    id: "m2",
    from: "Daniel Okafor",
    address: "daniel@brightpath.example",
    subject: "Lunch on Thursday?",
    date: "2026-10-25T17:40:00",
    body: "Hey,\n\nAre you free for lunch on Thursday? There is a new place near the station that does good noodles. Say 12:30?\n\nDaniel",
  },
  {
    id: "m3",
    from: "Orbit Labs",
    address: "team@orbit-labs.example",
    subject: "Orbit Todo 0.3.1 release notes",
    date: "2026-10-25T10:05:00",
    body: "Orbit Todo 0.3.1 is out.\n\n- Tasks now persist to localStorage\n- Filter by status: all, active, done\n- Faster startup\n\nThanks for trying it out.",
  },
  {
    id: "m4",
    from: "Sofia Marin",
    address: "sofia@lumen.example",
    subject: "Draft of the conference abstract",
    date: "2026-10-24T15:30:00",
    body: "Hello,\n\nI attached a first draft of the abstract. It is about 180 words. Comments welcome, especially on the second paragraph.\n\nBest,\nSofia",
  },
  {
    id: "m5",
    from: "City Library",
    address: "no-reply@citylibrary.example",
    subject: "Your book is ready for pickup",
    date: "2026-10-23T09:00:00",
    body: "The item you reserved is ready for pickup at the main desk. It will be held for seven days.",
  },
  {
    id: "m6",
    from: "Kenji Watanabe",
    address: "kenji@harbor.example",
    subject: "Photos from the weekend",
    date: "2026-10-22T20:18:00",
    body: "Hi,\n\nHere are the photos from the hike. The ones near the lake came out best. Let me know if you want the full-size files.\n\nKenji",
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 'priya' -> contact address when known; keeps real addresses as they are. */
export function resolveRecipient(to, inbox = INBOX_SEED) {
  const t = String(to || "").trim();
  if (!t) return "";
  if (EMAIL_RE.test(t)) return t;
  const q = t.toLowerCase();
  const hit = inbox.find(
    (m) => m.from.toLowerCase().includes(q) || m.address.toLowerCase().startsWith(q),
  );
  return hit ? hit.address : t;
}

export const isValidRecipient = (to) => EMAIL_RE.test(String(to || "").trim());

export function formatMailDate(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
