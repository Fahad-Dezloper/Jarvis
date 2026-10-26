import useWidgetsStore from "@store/widgets";
import { WIDGET_KINDS } from "@module/desktop/system/widgetCore";

const DESCRIPTIONS = {
  "clock-calendar": "Digital clock with the month grid",
  clock: "Digital time and date",
  "analog-clock": "Classic analog clock face",
  weather: "Current conditions and the day's range",
  battery: "Battery level and charging state",
  notes: "A sticky note you can type into",
  music: "Now playing with play and pause",
};

/** Bottom drawer for adding and removing widgets. Opened from the desktop menu "Edit Widgets...". */
const WidgetGallery = () => {
  const widgets = useWidgetsStore((s) => s.widgets);
  const isEditMode = useWidgetsStore((s) => s.isEditMode);
  const setEditMode = useWidgetsStore((s) => s.setEditMode);
  const addWidget = useWidgetsStore((s) => s.addWidget);
  const removeWidget = useWidgetsStore((s) => s.removeWidget);

  if (!isEditMode) return null;
  return (
    <div
      role="dialog"
      aria-label="Widget gallery"
      className="fixed bottom-0 left-0 right-0 z-[100001] flex h-[200px] flex-col border-t border-white/15 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.45)] animate-in slide-in-from-bottom-10 duration-200"
      style={{ background: "rgba(28,28,30,0.78)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-8 py-3">
        <div>
          <h2 className="text-sm font-bold">Edit Widgets</h2>
          <p className="text-xs text-white/50">Add widgets, or drag them on the desktop to place them.</p>
        </div>
        <button type="button" onClick={() => setEditMode(false)} className="rounded-full bg-white px-5 py-1.5 text-sm font-bold text-black shadow-md hover:bg-zinc-200">
          Done
        </button>
      </div>
      <div className="flex flex-1 items-center gap-4 overflow-x-auto px-8">
        {WIDGET_KINDS.map((k) => {
          const on = widgets.includes(k.type);
          return (
            <div key={k.type} className="flex h-[104px] w-52 shrink-0 flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <div className="text-xs font-bold">{k.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-white/50">{DESCRIPTIONS[k.type]}</div>
              </div>
              <button
                type="button"
                onClick={() => (on ? removeWidget(k.type) : addWidget(k.type))}
                className={`self-end rounded-full px-3.5 py-1 text-xs font-bold text-white shadow ${on ? "bg-white/20 hover:bg-red-500" : "bg-blue-500 hover:bg-blue-600"}`}
              >
                {on ? "Remove" : "+ Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WidgetGallery;
export { WidgetGallery };
