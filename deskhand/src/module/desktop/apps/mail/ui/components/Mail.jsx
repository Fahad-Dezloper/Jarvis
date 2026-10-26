import { useEffect } from "react";
import { Inbox, Send, FileText, Pencil, X } from "lucide-react";
import WindowControls from "@components/WindowControls";
import windowWrapper from "@hoc/windowWrapper";
import useWindowsStore from "@store/window";
import useMailStore from "../../mailStore";
import { formatMailDate } from "../../mailCore";
import "../../handlers";

const FOLDERS = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "sent", label: "Sent", Icon: Send },
  { id: "drafts", label: "Drafts", Icon: FileText },
];

const Field = ({ label, value, onChange, disabled, multiline }) => (
  <label className="flex gap-2 items-start border-b border-gray-200 py-1.5 text-sm">
    <span className="w-14 shrink-0 text-gray-500 pt-0.5">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex-1 outline-none bg-transparent resize-none h-52"
        aria-label={label}
      />
    ) : (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex-1 outline-none bg-transparent"
        aria-label={label}
      />
    )}
  </label>
);

const Mail = () => {
  const s = useMailStore();
  const isOpen = useWindowsStore((st) => st.windows.mail?.isOpen);

  useEffect(() => {
    if (!s.toast) return;
    const t = setTimeout(() => s.clearToast(), 3200);
    return () => clearTimeout(t);
  }, [s.toast]);

  const list = s[s.folder];
  const selected = list.find((m) => m.id === s.selectedId);
  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-xl overflow-hidden border border-black/10 shadow-xl select-none relative text-[#1d1d1f]">
      <div
        id="window-header"
        className="window-header flex items-center gap-3 px-4 h-11 bg-[#f4f4f6] border-b border-gray-200 shrink-0"
      >
        <WindowControls target="mail" />
        <span className="text-sm font-medium ml-2">Mail</span>
        <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
          Simulated mail
        </span>
        <button
          onClick={() => s.openCompose()}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          <Pencil size={12} /> Compose
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="w-40 shrink-0 bg-[#f4f4f6] border-r border-gray-200 p-2 space-y-0.5">
          {FOLDERS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => s.setFolder(id)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] ${s.folder === id ? "bg-blue-100 text-blue-800" : "hover:bg-black/5"}`}
            >
              <Icon size={14} /> {label}
              <span className="ml-auto text-[11px] text-gray-500">{s[id].length || ""}</span>
            </button>
          ))}
        </aside>
        <section className="w-64 shrink-0 border-r border-gray-200 overflow-auto">
          {list.length === 0 && <p className="p-4 text-xs text-gray-400">Nothing here yet.</p>}
          {list.map((m) => (
            <button
              key={m.id}
              onClick={() => s.select(m.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-gray-100 ${m.id === s.selectedId ? "bg-blue-50" : "hover:bg-gray-50"}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium truncate flex-1">
                  {m.from || `To: ${m.to}`}
                </span>
                <span className="text-[10px] text-gray-400">{formatMailDate(m.date)}</span>
              </div>
              <div className="text-xs truncate">{m.subject}</div>
              <div className="text-[11px] text-gray-500 truncate">
                {m.body.replace(/\s+/g, " ")}
              </div>
            </button>
          ))}
        </section>
        <section className="flex-1 min-w-0 overflow-auto select-text">
          {selected ? (
            <div className="p-5">
              <h2 className="text-lg font-semibold mb-1">{selected.subject}</h2>
              <p className="text-xs text-gray-500 mb-4">
                {selected.from ? `${selected.from} <${selected.address}>` : `To: ${selected.to}`} |{" "}
                {formatMailDate(selected.date)}
              </p>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{selected.body}</div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Select a message
            </div>
          )}
        </section>
      </div>

      {s.compose && (
        <div
          className="absolute right-4 bottom-4 w-[420px] max-w-[92%] bg-white rounded-xl shadow-2xl border border-gray-300 z-20"
          data-testid="mail-compose"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center px-3 py-2 bg-[#f4f4f6] rounded-t-xl border-b border-gray-200">
            <span className="text-xs font-medium">New message</span>
            <span className="ml-2 text-[10px] text-amber-700">simulated</span>
            <button
              onClick={s.discard}
              className="ml-auto p-1 rounded hover:bg-black/10"
              aria-label="Discard"
            >
              <X size={13} />
            </button>
          </div>
          <div className="px-3 pt-1 pb-3">
            <Field
              label="To"
              value={s.compose.to}
              onChange={(v) => s.patchCompose({ to: v })}
              disabled={s.compose.typing}
            />
            <Field
              label="Subject"
              value={s.compose.subject}
              onChange={(v) => s.patchCompose({ subject: v })}
              disabled={s.compose.typing}
            />
            <Field
              label="Message"
              value={s.compose.body}
              onChange={(v) => s.patchCompose({ body: v })}
              disabled={s.compose.typing}
              multiline
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => s.send()}
                disabled={!s.compose.to.trim() || s.compose.typing}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Send
              </button>
              <button
                onClick={s.saveDraft}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200"
              >
                Save draft
              </button>
              <button
                onClick={s.discard}
                className="px-3 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100 ml-auto"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
      {s.toast && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-5 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg z-30"
          role="status"
        >
          {s.toast}
        </div>
      )}
    </div>
  );
};

const MailWindow = windowWrapper(Mail, "mail");
export default MailWindow;
