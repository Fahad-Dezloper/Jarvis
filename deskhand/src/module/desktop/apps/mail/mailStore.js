import { create } from "zustand";
import { INBOX_SEED } from "./mailCore.js";

const useMailStore = create((set, get) => ({
  inbox: INBOX_SEED,
  sent: [],
  drafts: [],
  folder: "inbox",
  selectedId: null,
  compose: null, // { to, subject, body, typing }
  toast: null,
  setFolder: (folder) => set({ folder, selectedId: null }),
  select: (id) => set({ selectedId: id }),
  openCompose: (init = {}) =>
    set({
      compose: { to: "", subject: "", body: "", typing: false, ...init },
      folder: get().folder,
    }),
  patchCompose: (patch) => set((s) => (s.compose ? { compose: { ...s.compose, ...patch } } : {})),
  discard: () => set({ compose: null }),
  saveDraft: () => {
    const c = get().compose;
    if (!c) return;
    set((s) => ({
      drafts: [
        {
          id: `d${Date.now()}`,
          to: c.to,
          subject: c.subject || "(no subject)",
          body: c.body,
          date: new Date().toISOString(),
        },
        ...s.drafts,
      ],
      compose: null,
      toast: "Draft saved",
    }));
  },
  send: () => {
    const c = get().compose;
    if (!c) return null;
    const msg = {
      id: `s${Date.now()}`,
      to: c.to,
      subject: c.subject || "(no subject)",
      body: c.body,
      date: new Date().toISOString(),
    };
    set((s) => ({
      sent: [msg, ...s.sent],
      compose: null,
      folder: "sent",
      selectedId: msg.id,
      toast: `Message sent to ${c.to} (simulated)`,
    }));
    return msg;
  },
  clearToast: () => set({ toast: null }),
}));

export default useMailStore;
