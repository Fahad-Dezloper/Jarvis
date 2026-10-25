import React, { useRef, useEffect } from "react";
import { FileText } from "lucide-react";

const NoteEditor = ({ activeNote, flash, onUpdateNote, onCreateNote }) => {
  const editorRef = useRef(null);

  // Sync editor content only when activeNote.id changes to prevent cursor jumping
  useEffect(() => {
    if (editorRef.current && activeNote) {
      if (editorRef.current.innerHTML !== activeNote.body) {
        editorRef.current.innerHTML = activeNote.body || "";
      }
    }
  }, [activeNote]);

  // Briefly highlight the last line after a voice-driven append.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !flash?.n) return;
    const last = el.lastElementChild;
    if (!last) return;
    last.classList.add("dk-note-flash");
    try {
      last.scrollIntoView({ block: "nearest" });
    } catch {
      /* ignore */
    }
    const timer = setTimeout(() => {
      last.classList.remove("dk-note-flash");
      if (!last.getAttribute("class")) last.removeAttribute("class");
    }, 1800);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleInput = () => {
    if (editorRef.current) {
      onUpdateNote("body", editorRef.current.innerHTML);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#fbfaf8] p-5 md:p-6 overflow-y-auto">
      <style>{`
        @keyframes dkNoteFlash {
          0% { background: rgba(228, 165, 46, 0.55); }
          100% { background: rgba(228, 165, 46, 0); }
        }
        .dk-note-flash { animation: dkNoteFlash 1.6s ease-out; border-radius: 4px; }
      `}</style>
      {activeNote ? (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="notes-content-area flex-1 w-full bg-transparent text-sm resize-none border-none outline-none focus:ring-0 focus:outline-none font-sans leading-relaxed text-gray-800 min-h-[300px]"
          data-placeholder="Start writing..."
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <FileText className="w-12 h-12 stroke-1 mb-2 opacity-50 text-[#e4a52e]" />
          <p className="text-sm">No Note Selected</p>
          <button
            onClick={onCreateNote}
            className="mt-4 px-4 py-2 bg-[#e4a52e] hover:bg-[#d89216] text-white rounded-lg text-sm font-semibold active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Create a Note
          </button>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;
