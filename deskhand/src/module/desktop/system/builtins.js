// The icons that ship on the desktop (Projects folder, Readme), captured once so
// Home and the system handlers agree on what "built in" means.
import { locations } from "@constants";
import { README_FILE } from "@constants/locations";

export const README_DESKTOP_FILE = { ...README_FILE, id: "desktop-readme", windowPosition: "top-[35vh] left-6" };
export const BUILTIN_WORK_CHILDREN = [...(locations.work?.children ?? [])];
export const DESKTOP_BUILTINS = [...BUILTIN_WORK_CHILDREN, README_DESKTOP_FILE];
