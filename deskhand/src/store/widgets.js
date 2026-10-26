import { create } from "zustand";
import { WIDGET_KINDS } from "@module/desktop/system/widgetCore";

export const WIDGET_OPTIONS = WIDGET_KINDS.map((k) => ({ type: k.type, label: k.label }));

const KEY = "deskhand.widgets.v1";
const DEFAULT = { widgets: ["clock-calendar"], anchors: {}, custom: {}, noteText: "" };

function load() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (!raw) return DEFAULT;
    const d = JSON.parse(raw);
    const valid = new Set(WIDGET_KINDS.map((k) => k.type));
    return {
      widgets: Array.isArray(d.widgets) ? d.widgets.filter((w) => valid.has(w)) : DEFAULT.widgets,
      anchors: d.anchors && typeof d.anchors === "object" ? d.anchors : {},
      custom: d.custom && typeof d.custom === "object" ? d.custom : {},
      noteText: typeof d.noteText === "string" ? d.noteText : "",
    };
  } catch {
    return DEFAULT;
  }
}

function save(s) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ widgets: s.widgets, anchors: s.anchors, custom: s.custom, noteText: s.noteText }),
    );
  } catch {
    // storage unavailable or full: widgets still work for this session
  }
}

const useWidgetsStore = create((set, get) => {
  const commit = (patch) => {
    set(patch);
    save(get());
  };
  return {
    ...load(),
    isEditMode: false,
    setEditMode: (v) => set({ isEditMode: Boolean(v) }),
    toggleWidget: (type) => {
      const s = get();
      if (s.widgets.includes(type)) get().removeWidget(type);
      else get().addWidget(type);
    },
    addWidget: (type, anchor = "top-right") => {
      const s = get();
      if (s.widgets.includes(type)) return;
      commit({ widgets: [...s.widgets, type], anchors: { ...s.anchors, [type]: anchor } });
    },
    removeWidget: (type) => {
      const s = get();
      const { [type]: _a, ...anchors } = s.anchors;
      const { [type]: _c, ...custom } = s.custom;
      commit({ widgets: s.widgets.filter((w) => w !== type), anchors, custom });
    },
    moveWidget: (type, anchor) => {
      const s = get();
      const { [type]: _c, ...custom } = s.custom;
      commit({ anchors: { ...s.anchors, [type]: anchor }, custom });
    },
    setCustomPosition: (type, left, top) => {
      const s = get();
      commit({ custom: { ...s.custom, [type]: { left, top } } });
    },
    setNoteText: (noteText) => commit({ noteText: String(noteText).slice(0, 2000) }),
    replaceWidget: (oldType, newType) =>
      commit({
        widgets: get().widgets.includes(newType)
          ? get().widgets.filter((w) => w !== oldType)
          : get().widgets.map((w) => (w === oldType ? newType : w)),
      }),
  };
});

export default useWidgetsStore;
