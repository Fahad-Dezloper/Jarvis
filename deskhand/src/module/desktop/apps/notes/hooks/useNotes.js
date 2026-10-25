import { useState, useEffect, useRef } from "react";
import "../../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";

const defaultFolders = [
  { id: "all", name: "All Notes" },
  { id: "notes", name: "Notes" },
  { id: "quick", name: "Quick Notes" },
];

const defaultNotes = [
  {
    id: "1",
    folderId: "notes",
    title: "Welcome to Notes",
    preview:
      "This is a macOS-style Notes application integrated into this interactive desktop portfolio.",
    body: "<div><strong>Welcome to Notes</strong></div><div><br></div><div>This is a macOS-style Notes application integrated into this interactive desktop portfolio.</div><div><br></div><div><strong>Features:</strong></div><ul><li>Add new notes using the compose button</li><li>Delete notes when they are no longer needed</li><li>Real-time search to quickly find what you're looking for</li><li>Automated persistence so your thoughts are saved locally!</li></ul>",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    folderId: "quick",
    title: "Idea Log",
    preview: "Build a fully functioning macOS desktop experience using React & Tailwind (Done!)",
    body: "<div><strong>Idea Log</strong></div><div><br></div><ul><li>Build a fully functioning macOS desktop experience using React &amp; Tailwind (Done!)</li><li>Add interactive apps like Notes, Safari, Calculator, Photos, and Terminal</li><li>Design a gorgeous Control Center and mobile responsive iOS shell</li></ul>",
    updatedAt: new Date().toISOString(),
  },
];

const readStorage = (key, fallback, validate) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!validate || validate(parsed)) return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  return fallback;
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
};

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const nonEmptyArray = (v) => Array.isArray(v) && v.length > 0;

export default function useNotes() {
  const [folders, setFolders] = useState(() =>
    readStorage("macos_portfolio_note_folders", defaultFolders, nonEmptyArray),
  );

  const [notes, setNotes] = useState(() =>
    readStorage("macos_portfolio_notes", defaultNotes, nonEmptyArray),
  );

  const [activeFolderId, setActiveFolderId] = useState("all");
  // Start with the first note selected so something is always visible.
  const [activeNoteId, setActiveNoteId] = useState(() => notes[0]?.id || "");
  const [flash, setFlash] = useState({ id: "", n: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    writeStorage("macos_portfolio_note_folders", folders);
  }, [folders]);

  useEffect(() => {
    writeStorage("macos_portfolio_notes", notes);
  }, [notes]);

  const stripHtml = (html) => {
    if (!html) return "";
    const clean = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Decode common entities
    return clean
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  };

  const parseNoteTitleAndBody = (html) => {
    if (!html) return { title: "New Note", preview: "No additional text" };

    // Replace common block tags with newlines to split correctly
    let text = html
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, ""); // Strip all tags

    // Decode entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const title = lines[0] || "New Note";
    const preview = lines.slice(1).join(" ").trim() || "No additional text";
    return { title, preview };
  };

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const handleUpdateNote = (field, value) => {
    if (!activeNote) return;

    setNotes((prevNotes) => {
      return prevNotes.map((note) => {
        if (note.id === activeNote.id) {
          const updated = {
            ...note,
            [field]: value,
            updatedAt: new Date().toISOString(),
          };
          if (field === "body") {
            const { title, preview } = parseNoteTitleAndBody(value);
            updated.title = title;
            updated.preview = preview;
          }
          return updated;
        }
        return note;
      });
    });
  };

  const handleCreateNote = (title) => {
    const named = typeof title === "string" && title.trim() ? title.trim() : "";
    const newNote = {
      id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
      folderId: activeFolderId === "all" ? "notes" : activeFolderId,
      title: named || "New Note",
      preview: named ? "No additional text" : "Start writing...",
      body: named
        ? `<div><strong>${escapeHtml(named)}</strong></div><div><br></div>`
        : "<div><strong>New Note</strong></div><div>Start writing...</div>",
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    return newNote;
  };

  const handleDeleteNote = (id) => {
    const newNotes = notes.filter((note) => note.id !== id);
    setNotes(newNotes);
    if (activeNoteId === id) {
      const remainingFiltered = newNotes.filter(
        (n) => activeFolderId === "all" || n.folderId === activeFolderId,
      );
      setActiveNoteId(remainingFiltered[0]?.id || "");
    }
  };

  const handleCreateFolder = (name) => {
    if (!name.trim()) return;
    const newFolder = {
      id: Date.now().toString(),
      name: name.trim(),
    };
    setFolders((prev) => [...prev, newFolder]);
    setActiveFolderId(newFolder.id);
  };

  const handleDeleteFolder = (folderId) => {
    if (folderId === "all" || folderId === "notes" || folderId === "quick") return;
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    // Move notes in deleted folder to general "notes"
    setNotes((prev) =>
      prev.map((n) => (n.folderId === folderId ? { ...n, folderId: "notes" } : n)),
    );
    setActiveFolderId("all");
  };

  const getFilteredNotes = () => {
    let result = notes;
    if (activeFolderId !== "all") {
      result = notes.filter((n) => n.folderId === activeFolderId);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          stripHtml(note.body).toLowerCase().includes(query),
      );
    }
    return result;
  };

  const filteredNotes = getFilteredNotes();

  // Fresh state for the voice handlers (registered once, read through refs).
  const live = useRef({});
  useEffect(() => {
    live.current = { notes, activeNote, createNote: handleCreateNote };
  });

  useEffect(() => {
    const unregister = registerHandlers("notes", {
      append_note: (args) => {
        try {
          const text = String(args?.text ?? "").trim();
          if (!text) return { ok: false, message: "There was no text to add to the note." };
          const { activeNote: current } = live.current;
          let target = current;
          let id = target?.id;
          if (!target) {
            const created = live.current.createNote("New Note");
            id = created.id;
            target = created;
          }
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          const html = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join("");
          setNotes((prev) =>
            prev.map((n) => {
              if (n.id !== id) return n;
              const base = (n.body || "").replace(/(<div><br><\/div>)+$/i, "");
              const body = base + html;
              const { title, preview } = parseNoteTitleAndBody(body);
              return { ...n, body, title, preview, updatedAt: new Date().toISOString() };
            }),
          );
          setActiveNoteId(id);
          setFlash((f) => ({ id, n: f.n + 1 }));
          const title = target.title || "the note";
          return {
            ok: true,
            message: `Added to "${title}": ${text.length > 120 ? text.slice(0, 117) + "..." : text}`,
          };
        } catch (err) {
          return { ok: false, message: `Could not add to the note: ${err?.message || err}` };
        }
      },
      new_note: (args) => {
        try {
          const title = String(args?.title ?? "").trim();
          setActiveFolderId("all");
          live.current.createNote(title);
          return { ok: true, message: title ? `Created a new note "${title}".` : "Created a new note." };
        } catch (err) {
          return { ok: false, message: `Could not create the note: ${err?.message || err}` };
        }
      },
    });
    const unregisterSummary = registerSummary("notes", () => {
      const { notes: all, activeNote: current } = live.current;
      if (!current) return `Notes has ${all.length} notes and none is open.`;
      const plain = stripHtml(current.body || "");
      const tail = plain.length > 80 ? "..." + plain.slice(-80) : plain;
      return `Notes has ${all.length} notes. Current note "${current.title}" ends with: ${tail}`;
    });
    return () => {
      unregister();
      unregisterSummary();
    };
  }, []);

  const formatDate = (isoStr) => {
    const date = new Date(isoStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Get counts for sidebar folder listing
  const getFolderCount = (folderId) => {
    if (folderId === "all") return notes.length;
    return notes.filter((n) => n.folderId === folderId).length;
  };

  return {
    notes,
    folders,
    activeFolderId,
    activeNote,
    activeNoteId,
    flash,
    searchQuery,
    isSidebarOpen,
    setActiveFolderId,
    setActiveNoteId,
    setSearchQuery,
    setIsSidebarOpen,
    handleUpdateNote,
    handleCreateNote,
    handleDeleteNote,
    handleCreateFolder,
    handleDeleteFolder,
    filteredNotes,
    formatDate,
    getFolderCount,
    stripHtml,
  };
}
