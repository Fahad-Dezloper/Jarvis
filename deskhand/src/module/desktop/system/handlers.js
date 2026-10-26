// Handlers for the windowless `desktop` capability group. They register as soon as
// this module loads in the browser (imported by SystemLayer) and never throw.
import { dockApps } from "@constants";
import "../apps/devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import useWindowsStore from "@store/window";
import useSystemStore from "@store/system";
import useWidgetsStore from "@store/widgets";
import useLocationStore from "@store/location";
import { WALLPAPERS, resolveWallpaper, wallpaperById } from "./wallpaperCore";
import { WIDGET_KINDS, describeAnchor, kindList, normalizeAnchor, resolveWidgetKind } from "./widgetCore";
import { cleanName, describeItems, findByName, textFileName } from "./desktopItemsCore";
import { UNREMOVABLE_DOCK, clampLevel, dockInsert, planShowDesktop, resolveDockApp } from "./systemCore";
import { DESKTOP_BUILTINS } from "./builtins";
import { openFileItem, searchSpotlight } from "./spotlight";
import { locationFor, syncLocations } from "./syncLocations";
import { takeScreenshot } from "./screenshot";

const win = () => useWindowsStore.getState();
const sys = () => useSystemStore.getState();
const ok = (message, data) => ({ ok: true, message, ...(data ? { data } : {}) });
const fail = (message) => ({ ok: false, message });
const guard = (name, fn) => async (args) => {
  try {
    return await fn(args || {});
  } catch (err) {
    return fail(`${name} failed: ${err?.message || err}`);
  }
};
const parseBool = (v) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "on", "yes", "hide", "hidden", "enable", "1"].includes(s)) return true;
  if (["false", "off", "no", "show", "shown", "disable", "0"].includes(s)) return false;
  return null;
};

/** Find a desktop entry (own item or built-in icon) by name. */
function findEntry(name) {
  const s = sys();
  const own = s.items.map((i) => ({ src: "item", id: i.id, name: i.name, kind: i.kind, item: i }));
  const built = DESKTOP_BUILTINS.filter((b) => !s.deletedBuiltinIds.includes(b.id)).map((b) => ({
    src: "builtin",
    id: b.id,
    name: s.renamedBuiltins[b.id] || b.name,
    kind: b.kind,
    item: b,
  }));
  return findByName(name, [...own, ...built]);
}

const dockName = (id) => dockApps.find((a) => a.id === id)?.name || id;

function desktopSummary() {
  const s = sys();
  const w = win();
  const wid = useWidgetsStore.getState();
  const st = w.systemSettings;
  const { built, items } = { built: DESKTOP_BUILTINS.filter((b) => !s.deletedBuiltinIds.includes(b.id)), items: s.items.filter((i) => !i.parent) };
  const names = [...built.map((b) => s.renamedBuiltins[b.id] || b.name), ...items.map((i) => i.name)];
  return [
    `Wallpaper: ${wallpaperById(s.wallpaperId).label}. Available: ${WALLPAPERS.map((x) => x.label).join(", ")}.`,
    `Widgets: ${wid.widgets.length ? wid.widgets.map((k) => `${k}@${wid.anchors[k] || "top-right"}`).join(", ") : "none"} (kinds: ${kindList()}).`,
    `Dock: ${w.dockAppIds.join(", ")}; auto-hide ${s.dockAutohide ? "on" : "off"}.`,
    `${st.darkMode ? "Dark" : "Light"} mode, brightness ${st.brightness}, volume ${w.music.isMuted ? 0 : w.music.volume}${s.locked ? ", screen locked" : ""}.`,
    `Desktop items: ${names.join(", ") || "none"}. Trash: ${s.trash.length} item(s).`,
  ].join("\n");
}

if (typeof window !== "undefined") {
  // Re-apply persisted dock order once.
  try {
    const ids = sys().dockIds;
    if (Array.isArray(ids)) {
      const valid = ids.filter((id) => dockApps.some((a) => a.id === id));
      if (valid.length) useWindowsStore.setState({ dockAppIds: valid });
    }
  } catch {
    // keep default dock
  }
  syncLocations();
  useSystemStore.subscribe((s, p) => {
    if (s.revision !== p.revision || s.deletedBuiltinIds !== p.deletedBuiltinIds || s.renamedBuiltins !== p.renamedBuiltins) syncLocations();
  });
  let lastDock = useWindowsStore.getState().dockAppIds;
  useWindowsStore.subscribe((s) => {
    if (s.dockAppIds !== lastDock) {
      lastDock = s.dockAppIds;
      if (s.dockAppIds && JSON.stringify(s.dockAppIds) !== JSON.stringify(sys().dockIds)) sys().setDockIds([...s.dockAppIds]);
    }
  });

  registerHandlers("desktop", {
    set_wallpaper: guard("set_wallpaper", (a) => {
      const r = resolveWallpaper(a.name ?? a.wallpaper ?? a.color ?? a.colour, sys().wallpaperId);
      if (!r.ok) return fail(r.message);
      if (r.wallpaper.id === sys().wallpaperId) return ok(`The wallpaper is already ${r.wallpaper.label}.`, r.wallpaper.label);
      sys().setWallpaper(r.wallpaper.id);
      return ok(`Wallpaper changed to ${r.wallpaper.label}.`, r.wallpaper.label);
    }),
    list_wallpapers: guard("list_wallpapers", () => {
      const cur = sys().wallpaperId;
      const lines = WALLPAPERS.map((w, i) => `${i + 1}. ${w.label}${w.plain ? " (plain colour)" : ""}${w.id === cur ? " (current)" : ""}`);
      return ok(`${WALLPAPERS.length} wallpapers available.`, lines.join("\n"));
    }),

    widget_list: guard("widget_list", () => {
      const wid = useWidgetsStore.getState();
      const on = wid.widgets.map((k) => `${k} (${describeAnchor(wid.anchors[k])})`);
      return ok(on.length ? `Widgets on the desktop: ${on.join(", ")}.` : "There are no widgets on the desktop.", `On desktop: ${on.join(", ") || "none"}\nAvailable kinds: ${WIDGET_KINDS.map((k) => k.type).join(", ")}\nPositions: top-left, top-right, bottom-left, bottom-right, center`);
    }),
    widget_add: guard("widget_add", (a) => {
      const r = resolveWidgetKind(a.kind);
      if (!r.ok) return fail(r.message);
      const anchor = a.position ? normalizeAnchor(a.position) : null;
      if (a.position && !anchor) return fail(`"${a.position}" is not a position. Use top-left, top-right, bottom-left, bottom-right or center.`);
      const wid = useWidgetsStore.getState();
      if (wid.widgets.includes(r.kind.type)) {
        if (anchor) {
          wid.moveWidget(r.kind.type, anchor);
          return ok(`The ${r.kind.label} widget was already there; moved it to the ${describeAnchor(anchor)}.`);
        }
        return ok(`The ${r.kind.label} widget is already on the desktop.`);
      }
      wid.addWidget(r.kind.type, anchor || "top-right");
      return ok(`Added the ${r.kind.label} widget at the ${describeAnchor(anchor || "top-right")}.`);
    }),
    widget_remove: guard("widget_remove", (a) => {
      const r = resolveWidgetKind(a.kind);
      if (!r.ok) return fail(r.message);
      const wid = useWidgetsStore.getState();
      if (!wid.widgets.includes(r.kind.type)) return fail(`The ${r.kind.label} widget is not on the desktop. Current widgets: ${wid.widgets.join(", ") || "none"}.`);
      wid.removeWidget(r.kind.type);
      return ok(`Removed the ${r.kind.label} widget.`);
    }),
    widget_move: guard("widget_move", (a) => {
      const r = resolveWidgetKind(a.kind);
      if (!r.ok) return fail(r.message);
      const anchor = normalizeAnchor(a.position);
      if (!anchor) return fail(`"${a.position ?? ""}" is not a position. Use top-left, top-right, bottom-left, bottom-right or center.`);
      const wid = useWidgetsStore.getState();
      const had = wid.widgets.includes(r.kind.type);
      if (had) wid.moveWidget(r.kind.type, anchor);
      else wid.addWidget(r.kind.type, anchor);
      return ok(had ? `Moved the ${r.kind.label} widget to the ${describeAnchor(anchor)}.` : `The ${r.kind.label} widget was not on the desktop, so I added it at the ${describeAnchor(anchor)}.`);
    }),

    dock_add: guard("dock_add", (a) => {
      const app = resolveDockApp(a.app, dockApps.filter((x) => x.canOpen));
      if (!app) return fail(`I do not know an app called "${a.app ?? ""}". Dock apps: ${dockApps.map((x) => x.name).join(", ")}.`);
      const ids = win().dockAppIds;
      if (ids.includes(app.id)) return ok(`${app.name} is already in the dock.`);
      useWindowsStore.setState({ dockAppIds: dockInsert(ids, app.id) });
      return ok(`Added ${app.name} to the dock.`);
    }),
    dock_remove: guard("dock_remove", (a) => {
      const app = resolveDockApp(a.app, dockApps);
      if (!app) return fail(`I do not know an app called "${a.app ?? ""}". In the dock: ${win().dockAppIds.map(dockName).join(", ")}.`);
      if (UNREMOVABLE_DOCK.includes(app.id)) return fail(`${app.name} stays in the dock, as on a real Mac.`);
      const ids = win().dockAppIds;
      if (!ids.includes(app.id)) return ok(`${app.name} is not in the dock.`);
      useWindowsStore.setState({ dockAppIds: ids.filter((i) => i !== app.id) });
      return ok(`Removed ${app.name} from the dock.`);
    }),
    dock_autohide: guard("dock_autohide", (a) => {
      const v = parseBool(a.hidden ?? a.enabled ?? a.value);
      if (v === null) return fail("Say whether the dock should hide (true) or stay visible (false).");
      sys().setDockAutohide(v);
      return ok(v ? "Dock auto-hide is on. Move the pointer to the bottom edge to reveal it." : "Dock auto-hide is off.");
    }),

    create_folder: guard("create_folder", (a) => {
      const name = cleanName(a.name, "untitled folder");
      const it = sys().createItem("folder", name, {});
      return ok(`Created the folder "${it.name}" on the desktop.`, it.name);
    }),
    create_file: guard("create_file", (a) => {
      const it = sys().createItem("file", textFileName(a.name), { text: String(a.text ?? "") });
      return ok(`Created "${it.name}" on the desktop${a.text ? "" : " (empty)"}.`, it.name);
    }),
    rename_item: guard("rename_item", (a) => {
      const to = cleanName(a.to ?? a.name, "");
      if (!to) return fail("I need the new name.");
      const e = findEntry(a.from);
      if (!e) return fail(`I could not find "${a.from ?? ""}" on the desktop. Items: ${describeAll()}.`);
      if (e.src === "builtin") {
        sys().renameBuiltin(e.id, to);
        return ok(`Renamed "${e.name}" to "${to}".`);
      }
      const final = sys().renameItem(e.id, e.kind === "file" && !/\.[a-z0-9]{1,5}$/i.test(to) ? textFileName(to) : to);
      return ok(`Renamed "${e.name}" to "${final}".`);
    }),
    delete_item: guard("delete_item", (a) => {
      const e = findEntry(a.name);
      if (!e) return fail(`I could not find "${a.name ?? ""}" on the desktop. Items: ${describeAll()}.`);
      if (e.src === "builtin") sys().trashBuiltin(e.id, e.name, e.kind === "folder" ? "folder" : "file");
      else sys().trashItemById(e.id);
      return ok(`Moved "${e.name}" to the Trash.`);
    }),
    restore_item: guard("restore_item", (a) => {
      const t = findByName(a.name, sys().trash);
      if (!t) return fail(`Nothing called "${a.name ?? ""}" is in the Trash. Trash: ${sys().trash.map((x) => x.name).join(", ") || "empty"}.`);
      const n = sys().restoreFromTrash(t.id);
      return ok(`Put "${n || t.name}" back on the desktop.`);
    }),
    empty_trash: guard("empty_trash", () => {
      const n = sys().emptyTrash();
      return ok(n ? `Emptied the Trash (${n} item${n === 1 ? "" : "s"}).` : "The Trash was already empty.");
    }),
    list_desktop: guard("list_desktop", () => {
      const s = sys();
      const lines = [];
      for (const b of DESKTOP_BUILTINS.filter((x) => !s.deletedBuiltinIds.includes(x.id))) lines.push(`${s.renamedBuiltins[b.id] || b.name}${b.kind === "folder" ? "/" : ""}`);
      lines.push(...describeItems(s.items, null));
      for (const f of s.items.filter((i) => i.kind === "folder")) {
        const inside = describeItems(s.items, f.id);
        if (inside.length) lines.push(`${f.name}/ contains: ${inside.join(", ")}`);
      }
      return ok(`${lines.length} thing(s) on the desktop.`, `Desktop: ${lines.join("; ")}\nTrash: ${s.trash.map((t) => t.name).join(", ") || "empty"}`);
    }),
    open_item: guard("open_item", (a) => {
      const e = findEntry(a.name);
      if (!e) return fail(`I could not find "${a.name ?? ""}" on the desktop. Items: ${describeAll()}.`);
      if (e.src === "builtin") {
        const b = { ...e.item, name: e.name };
        if (b.kind === "file") win().openWindow(`${b.fileType}file`, b);
        else {
          useLocationStore.getState().setActiveLocation(b);
          win().openWindow("finder");
        }
        const text = Array.isArray(b.description) ? b.description.join("\n") : "";
        return ok(`Opened ${e.name}.`, text ? `${e.name}\n\n${text}`.slice(0, 5800) : undefined);
      }
      const loc = locationFor(e.item);
      openFileItem(loc);
      return ok(`Opened ${e.name}.`, e.kind === "file" ? `${e.name}\n\n${e.item.text || "(empty)"}`.slice(0, 5800) : undefined);
    }),

    show_desktop: guard("show_desktop", () => {
      const s = sys();
      const plan = planShowDesktop(win().windows, s.minimizedByShowDesktop);
      if (win().windows.launchpad?.isOpen) win().closeWindow("launchpad");
      if (plan.action === "restore") {
        plan.keys.forEach((k) => win().unminimizeWindow(k));
        s.setMinimizedByShowDesktop(null);
        return ok(plan.keys.length ? `Brought back ${plan.keys.length} window${plan.keys.length === 1 ? "" : "s"}.` : "Nothing to bring back.");
      }
      if (!plan.keys.length) return ok("The desktop is already clear.");
      plan.keys.forEach((k) => win().minimizeWindow(k));
      s.setMinimizedByShowDesktop(plan.keys);
      return ok(`Minimised ${plan.keys.length} window${plan.keys.length === 1 ? "" : "s"} to show the desktop. Call again to bring them back.`);
    }),
    open_launchpad: guard("open_launchpad", () => {
      win().openWindow("launchpad");
      return ok("Opened Launchpad.");
    }),
    close_launchpad: guard("close_launchpad", () => {
      if (!win().windows.launchpad?.isOpen) return ok("Launchpad was not open.");
      win().closeWindow("launchpad");
      return ok("Closed Launchpad.");
    }),
    spotlight: guard("spotlight", (a) => {
      const q = String(a.query ?? "").trim();
      sys().requestSpotlight(q);
      if (!q) return ok("Opened Spotlight.");
      const hits = searchSpotlight(q, 6);
      if (!hits.length) return ok(`Spotlight found nothing for "${q}".`, "No matches.");
      return ok(`Spotlight: top match is ${hits[0].name}.`, hits.map((h, i) => `${i + 1}. ${h.name} (${h.kind}) - ${h.desc}`).join("\n"));
    }),
    lock_screen: guard("lock_screen", () => {
      sys().setLocked(true);
      return ok("Locked the screen. Press Enter to unlock.");
    }),
    screenshot: guard("screenshot", async () => {
      const r = await takeScreenshot();
      return r.ok ? ok(`Screenshot saved to the Screenshots folder as "${r.name}".${r.note ? " " + r.note : ""}`, r.name) : fail(r.message);
    }),
    set_brightness: guard("set_brightness", (a) => {
      const n = clampLevel(a.level ?? a.value);
      if (n === null) return fail("I need a brightness from 0 to 100.");
      win().updateSystemSetting("brightness", n);
      return ok(`Brightness set to ${n}%.`);
    }),
    set_system_volume: guard("set_system_volume", (a) => {
      const n = clampLevel(a.level ?? a.value);
      if (n === null) return fail("I need a volume from 0 to 100.");
      win().setMusicState({ volume: n, isMuted: n === 0 });
      win().updateSystemSetting("soundLevel", n);
      return ok(`Volume set to ${n}%.`);
    }),
    about_this_mac: guard("about_this_mac", () => {
      win().openWindow("settings", { tab: "General", subPage: "about" });
      return ok("Opened About this Mac.");
    }),
    notification_center: guard("notification_center", (a) => {
      const want = a.open === undefined ? !sys().notificationCenterOpen : !["false", "no", "off", "close", "closed", "hide", "0"].includes(String(a.open).toLowerCase());
      sys().setNotificationCenterOpen(Boolean(want));
      return ok(want ? "Opened Notification Center." : "Closed Notification Center.");
    }),
  });

  registerSummary("desktop", desktopSummary);
}

function describeAll() {
  const s = sys();
  return [...DESKTOP_BUILTINS.filter((b) => !s.deletedBuiltinIds.includes(b.id)).map((b) => s.renamedBuiltins[b.id] || b.name), ...s.items.map((i) => i.name)].join(", ") || "none";
}
