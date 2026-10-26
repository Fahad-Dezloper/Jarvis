import { create } from "zustand";
import { DEFAULT_WALLPAPER_ID, WALLPAPERS } from "@module/desktop/system/wallpaperCore";
import { nextId, trashItem, restoreItem, uniqueName, cleanName } from "@module/desktop/system/desktopItemsCore";

const KEY = "deskhand.system.v1";

function load() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (!raw) return {};
    const d = JSON.parse(raw);
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

const saved = load();
const arr = (v) => (Array.isArray(v) ? v : []);

const useSystemStore = create((set, get) => {
  let quotaWarned = false;
  const persist = () => {
    const s = get();
    const body = {
      wallpaperId: s.wallpaperId,
      items: s.items,
      trash: s.trash,
      deletedBuiltinIds: s.deletedBuiltinIds,
      renamedBuiltins: s.renamedBuiltins,
      dockAutohide: s.dockAutohide,
      dockIds: s.dockIds,
    };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(body));
    } catch {
      // Most likely the quota (screenshots are the big items): drop their pictures and retry once.
      try {
        const slim = { ...body, items: body.items.map((i) => (i.kind === "image" ? { ...i, src: "" } : i)), trash: body.trash.map((i) => (i.kind === "image" ? { ...i, src: "" } : i)) };
        window.localStorage.setItem(KEY, JSON.stringify(slim));
      } catch {
        quotaWarned = true;
      }
    }
    return quotaWarned;
  };
  const commit = (patch) => {
    set(patch);
    persist();
  };

  return {
    wallpaperId: WALLPAPERS.some((w) => w.id === saved.wallpaperId) ? saved.wallpaperId : DEFAULT_WALLPAPER_ID,
    items: arr(saved.items),
    trash: arr(saved.trash),
    deletedBuiltinIds: arr(saved.deletedBuiltinIds),
    renamedBuiltins: saved.renamedBuiltins && typeof saved.renamedBuiltins === "object" ? saved.renamedBuiltins : {},
    dockAutohide: Boolean(saved.dockAutohide),
    dockIds: Array.isArray(saved.dockIds) ? saved.dockIds : null,
    // transient
    locked: false,
    minimizedByShowDesktop: null,
    spotlight: { nonce: 0, query: "" },
    notificationCenterOpen: false,
    screenshotToast: null,
    revision: 0,

    setWallpaper: (id) => commit({ wallpaperId: id }),

    createItem: (kind, name, extra = {}) => {
      const s = get();
      const parent = extra.parent ?? null;
      const finalName = uniqueName(cleanName(name, kind === "folder" ? "untitled folder" : "Untitled.txt"), s.items, parent);
      const item = { id: nextId(kind), kind, name: finalName, parent, ...extra };
      commit({ items: [...s.items, item], revision: s.revision + 1 });
      return item;
    },
    renameItem: (id, name) => {
      const s = get();
      const it = s.items.find((i) => i.id === id);
      if (!it) return null;
      const finalName = uniqueName(cleanName(name, it.name), s.items, it.parent ?? null, id);
      commit({ items: s.items.map((i) => (i.id === id ? { ...i, name: finalName } : i)), revision: s.revision + 1 });
      return finalName;
    },
    moveItem: (id, x, y) => commit({ items: get().items.map((i) => (i.id === id ? { ...i, x, y } : i)) }),
    setItemText: (id, text) => commit({ items: get().items.map((i) => (i.id === id ? { ...i, text } : i)), revision: get().revision + 1 }),
    trashItemById: (id) => {
      const s = get();
      const r = trashItem(s.items, s.trash, id);
      commit({ items: r.items, trash: r.trash, revision: s.revision + 1 });
    },
    trashBuiltin: (id, name, kind = "folder") => {
      const s = get();
      if (s.deletedBuiltinIds.includes(id)) return;
      commit({
        deletedBuiltinIds: [...s.deletedBuiltinIds, id],
        trash: [...s.trash, { id: nextId("builtin"), builtinId: id, kind, name, trashedAt: Date.now() }],
        revision: s.revision + 1,
      });
    },
    renameBuiltin: (id, name) => commit({ renamedBuiltins: { ...get().renamedBuiltins, [id]: name }, revision: get().revision + 1 }),
    restoreFromTrash: (id) => {
      const s = get();
      const t = s.trash.find((x) => x.id === id);
      if (!t) return null;
      if (t.builtinId !== undefined) {
        commit({ deletedBuiltinIds: s.deletedBuiltinIds.filter((b) => b !== t.builtinId), trash: s.trash.filter((x) => x.id !== id), revision: s.revision + 1 });
        return t.name;
      }
      const r = restoreItem(s.items, s.trash, id);
      commit({ items: r.items, trash: r.trash, revision: s.revision + 1 });
      return r.restored?.name ?? null;
    },
    emptyTrash: () => {
      const n = get().trash.length;
      commit({ trash: [], revision: get().revision + 1 });
      return n;
    },

    setDockAutohide: (v) => commit({ dockAutohide: Boolean(v) }),
    setDockIds: (ids) => commit({ dockIds: ids }),

    setLocked: (v) => set({ locked: Boolean(v) }),
    setMinimizedByShowDesktop: (v) => set({ minimizedByShowDesktop: v }),
    requestSpotlight: (query = "") => set((s) => ({ spotlight: { nonce: s.spotlight.nonce + 1, query } })),
    setNotificationCenterOpen: (v) => set({ notificationCenterOpen: Boolean(v) }),
    setScreenshotToast: (t) => set({ screenshotToast: t }),
    addScreenshot: (name, src) => {
      const s = get();
      let folder = s.items.find((i) => i.kind === "folder" && i.name === "Screenshots" && !i.parent);
      let items = s.items;
      if (!folder) {
        folder = { id: nextId("folder"), kind: "folder", name: "Screenshots", parent: null };
        items = [...items, folder];
      }
      const item = { id: nextId("image"), kind: "image", name: uniqueName(name, items, folder.id), parent: folder.id, src };
      commit({ items: [...items, item], revision: s.revision + 1 });
      return { item, folder, storageFull: quotaWarned };
    },
  };
});

export default useSystemStore;
