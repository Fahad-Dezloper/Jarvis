// Mirrors the system store (desktop items, Trash) into the Finder location tree so
// Finder shows what the desktop shows. Finder reads `locations` directly.
import { locations } from "@constants";
import useWindowsStore from "@store/window";
import useSystemStore from "@store/system";
import { BUILTIN_WORK_CHILDREN } from "./builtins";

const folderIcon = "/system/icons/files/folder.webp";
const txtIcon = "/system/icons/files/txt.webp";
const imgIcon = "/system/icons/files/image.webp";

function toLocation(item, all) {
  if (item.kind === "folder") {
    return {
      id: item.id,
      name: item.name,
      icon: folderIcon,
      kind: "folder",
      windowPosition: "top-[10vh] left-24",
      children: all.filter((c) => c.parent === item.id).map((c) => toLocation(c, all)),
    };
  }
  if (item.kind === "image") {
    return { id: item.id, name: item.name, icon: item.src || imgIcon, kind: "file", fileType: "img", imageUrl: item.src, windowPosition: "top-[12vh] left-40" };
  }
  const lines = String(item.text ?? "").split(/\n+/).filter((l) => l.trim().length);
  return { id: item.id, name: item.name, icon: txtIcon, kind: "file", fileType: "txt", windowPosition: "top-[12vh] left-40", description: lines.length ? lines : ["(empty)"] };
}

export function syncLocations() {
  const s = useSystemStore.getState();
  const top = s.items.filter((i) => !i.parent);
  const built = BUILTIN_WORK_CHILDREN.filter((b) => !s.deletedBuiltinIds.includes(b.id)).map((b) =>
    s.renamedBuiltins[b.id] ? { ...b, name: s.renamedBuiltins[b.id] } : b,
  );
  if (locations.work) locations.work.children = [...built, ...top.map((i) => toLocation(i, s.items))];
  if (locations.trash) {
    locations.trash.children = s.trash.map((t) => ({
      ...(t.builtinId !== undefined ? { id: t.id, name: t.name, icon: t.kind === "folder" ? folderIcon : txtIcon, kind: t.kind === "folder" ? "folder" : "file", children: [] } : toLocation(t, s.trash)),
      id: t.id,
    }));
  }
  // Finder subscribes to the windows store as a whole; touching a harmless field re-renders it.
  useWindowsStore.setState((st) => ({ ...st }));
}

/** Resolve a stored item to the Finder-shaped object (for opening). */
export function locationFor(item) {
  const all = useSystemStore.getState().items;
  return toLocation(item, all);
}
