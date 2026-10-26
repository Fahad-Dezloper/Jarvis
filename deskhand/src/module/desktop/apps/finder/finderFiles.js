// finder.read_file: text of Finder files (Projects / Demo Files / ...) and of the
// orbit-todo project files shared with the terminal. Pure, no alias imports.
import { findFinderItem } from "./finderSearch.js";
import { findProjectFile, PROJECT_FILES, PROJECT_NAME } from "../shared/orbitTodoProject.js";

const MAX = 5800;

export function readFinderFile(name, roots) {
  const q = String(name || "").trim();
  if (!q) return { ok: false, message: "No file name was given." };

  const looksLikeProjectFile = /[./]/.test(q) && !!findProjectFile(q);
  if (looksLikeProjectFile) {
    const f = findProjectFile(q);
    return { ok: true, message: `Read ${PROJECT_NAME}/${f.path}.`, data: f.text.slice(0, MAX) };
  }

  const item = findFinderItem(q, roots);
  if (item) {
    if (item.kind === "folder") {
      const names = (item.children || []).map((c) => c.name).join(", ");
      return {
        ok: true,
        message: `${item.name} is a folder.`,
        data: `Folder ${item.name} contains: ${names || "nothing"}.`,
      };
    }
    const text = Array.isArray(item.description)
      ? item.description.join("\n")
      : String(item.description || "");
    if (text)
      return {
        ok: true,
        message: `Read ${item.name}.`,
        data: `${item.name}\n\n${text}`.slice(0, MAX),
      };
    return { ok: false, message: `${item.name} has no readable text.` };
  }

  const proj = findProjectFile(q);
  if (proj)
    return {
      ok: true,
      message: `Read ${PROJECT_NAME}/${proj.path}.`,
      data: proj.text.slice(0, MAX),
    };
  if (/orbit[- ]?todo/i.test(q)) {
    const list = Object.keys(PROJECT_FILES).sort().join("\n");
    return {
      ok: true,
      message: `${PROJECT_NAME} project files.`,
      data: `Project ${PROJECT_NAME}/:\n${list}`,
    };
  }
  return { ok: false, message: `I could not find a file called "${q}" in Finder.` };
}
