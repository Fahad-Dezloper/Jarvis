// Spotlight corpus: apps, desktop files and folders, settings panes.
import { dockApps, locations } from "@constants";
import useSystemStore from "@store/system";
import useWindowsStore from "@store/window";
import useLocationStore from "@store/location";
import { SIDEBAR_GROUPS } from "@module/desktop/apps/settings/data/settingsData";
import { DESKTOP_BUILTINS } from "./builtins";
import { rankMatches } from "./systemCore";
import { locationFor } from "./syncLocations";

const APP_DESC = {
  finder: "Browse files and folders",
  launchpad: "All apps",
  chrome: "Web browser",
  safari: "Web browser",
  mail: "Email",
  calendar: "Calendar and events",
  notes: "Notes",
  music: "Music player",
  terminal: "Command line",
  vscode: "Code editor",
  calculator: "Calculator",
  weather: "Weather forecast",
  settings: "System settings",
  photos: "Photos and gallery",
};

export function openFileItem(loc) {
  const w = useWindowsStore.getState();
  if (loc.kind === "folder") {
    useLocationStore.getState().setActiveLocation(loc);
    w.openWindow("finder");
  } else if (loc.fileType === "img") {
    w.openWindow("imgfile", { name: loc.name, imageUrl: loc.imageUrl });
  } else {
    w.openWindow("txtfile", loc);
  }
}

/** All desktop-visible files and folders as Finder-shaped objects. */
export function desktopEntries() {
  const s = useSystemStore.getState();
  const built = DESKTOP_BUILTINS.filter((b) => !s.deletedBuiltinIds.includes(b.id)).map((b) => ({
    ...b,
    name: s.renamedBuiltins[b.id] || b.name,
  }));
  const own = s.items.map((i) => locationFor(i));
  return { built, own, items: s.items };
}

export function buildCorpus() {
  const corpus = [];
  for (const a of dockApps) {
    if (!a.canOpen || a.id === "folder") continue;
    corpus.push({
      name: a.name,
      desc: APP_DESC[a.id] || a.name,
      kind: "app",
      open: () => {
        if (a.id === "trash") {
          useLocationStore.getState().setActiveLocation(locations.trash);
          useWindowsStore.getState().openWindow("finder");
        } else useWindowsStore.getState().openWindow(a.id);
      },
    });
  }
  const { built, own } = desktopEntries();
  for (const f of [...built, ...own]) {
    corpus.push({
      name: f.name,
      desc: f.kind === "folder" ? "Folder on Desktop" : "Document on Desktop",
      kind: f.kind === "folder" ? "folder" : "file",
      open: () => openFileItem(f),
    });
  }
  const panes = SIDEBAR_GROUPS.flat().map((p) => p.id);
  for (const p of panes)
    corpus.push({
      name: `${p} Settings`,
      desc: "System Settings",
      kind: "setting",
      open: () => useWindowsStore.getState().openWindow("settings", { tab: p }),
    });
  return corpus;
}

export function searchSpotlight(query, limit = 8) {
  return rankMatches(query, buildCorpus(), limit);
}
