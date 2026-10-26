import { useEffect, useRef, useState } from "react";
import { Lock, User, Bell, Moon } from "lucide-react";
import dayjs from "dayjs";
import useSystemStore from "@store/system";
import useWindowsStore from "@store/window";
import useTimeStore from "@store/time";
import { wallpaperById } from "./wallpaperCore";
import { locationFor } from "./syncLocations";
import { openFileItem } from "./spotlight";
import "./handlers";

const FADE_MS = 700;
const bg = (src) => `url("${src}")`;

/** Full-screen wallpaper with a cross-fade between the previous and the next image. */
const WallpaperLayer = () => {
  const wallpaperId = useSystemStore((s) => s.wallpaperId);
  const [base, setBase] = useState(() => wallpaperById(wallpaperId).src);
  const [top, setTop] = useState(null);
  const [topVisible, setTopVisible] = useState(false);
  const currentRef = useRef(base);

  useEffect(() => {
    const next = wallpaperById(wallpaperId).src;
    if (next === currentRef.current) return undefined;
    let cancelled = false;
    let t1;
    let t2;
    const img = new Image();
    const start = () => {
      if (cancelled) return;
      setTop(next);
      setTopVisible(false);
      t1 = setTimeout(() => setTopVisible(true), 30);
      t2 = setTimeout(() => {
        if (cancelled) return;
        currentRef.current = next;
        setBase(next);
        setTop(null);
        setTopVisible(false);
        document.body.style.backgroundImage = bg(next);
      }, FADE_MS + 80);
    };
    img.onload = start;
    img.onerror = start;
    img.src = next;
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [wallpaperId]);

  useEffect(() => {
    document.body.style.backgroundImage = bg(base);
  }, [base]);

  const common = { position: "fixed", inset: 0, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", pointerEvents: "none", zIndex: -1 };
  return (
    <>
      <div aria-hidden="true" data-wallpaper-layer="base" style={{ ...common, backgroundImage: bg(base) }} />
      {top && (
        <div
          aria-hidden="true"
          data-wallpaper-layer="next"
          style={{ ...common, backgroundImage: bg(top), opacity: topVisible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-in-out` }}
        />
      )}
    </>
  );
};

const LockScreen = () => {
  const locked = useSystemStore((s) => s.locked);
  const setLocked = useSystemStore((s) => s.setLocked);
  const time = useTimeStore((s) => s.time);
  useEffect(() => {
    if (!locked) return undefined;
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setLocked(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [locked, setLocked]);
  if (!locked) return null;
  const d = dayjs(time);
  return (
    <div
      role="dialog"
      aria-label="Lock screen"
      className="fixed inset-0 z-[2000000] flex cursor-pointer select-none flex-col items-center justify-between bg-black/25 px-6 py-14 text-white backdrop-blur-2xl animate-fade-in"
      onClick={() => setLocked(false)}
    >
      <div className="flex flex-col items-center">
        <Lock className="mb-3 h-5 w-5 text-white/90" />
        <p className="text-lg font-medium tracking-wide text-white/90">{d.format("dddd, MMMM D")}</p>
        <h1 className="mt-1 text-8xl font-light tracking-tighter">{d.format("HH:mm")}</h1>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/15 shadow-md">
          <User className="h-6 w-6 text-white/90" />
        </div>
        <p className="text-sm font-medium tracking-wide text-white/80">Guest</p>
        <p className="animate-pulse text-sm text-white/70">Press Enter or click to unlock</p>
      </div>
    </div>
  );
};

const ScreenshotToast = () => {
  const toast = useSystemStore((s) => s.screenshotToast);
  const setToast = useSystemStore((s) => s.setScreenshotToast);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast, setToast]);
  if (!toast) return null;
  const open = () => {
    const folder = useSystemStore.getState().items.find((i) => i.kind === "folder" && i.name === "Screenshots");
    if (folder) openFileItem(locationFor(folder));
    setToast(null);
  };
  return (
    <button
      type="button"
      data-no-screenshot="true"
      onClick={open}
      className="fixed bottom-6 right-6 z-[100002] flex w-[210px] cursor-pointer flex-col gap-1.5 rounded-xl border border-white/25 bg-black/55 p-2 text-left text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right-8 duration-300"
    >
      <img src={toast.src} alt="Screenshot preview" className="aspect-video w-full rounded-md border border-white/20 object-cover" />
      <span className="px-1 text-[11px] font-semibold">Screenshot saved</span>
      <span className="truncate px-1 text-[10px] text-white/60">{toast.name}</span>
    </button>
  );
};

const NotificationCenter = () => {
  const open = useSystemStore((s) => s.notificationCenterOpen);
  const setOpen = useSystemStore((s) => s.setNotificationCenterOpen);
  const focus = useWindowsStore((s) => s.systemSettings.focusMode);
  const toggle = useWindowsStore((s) => s.toggleSystemSetting);
  const time = useTimeStore((s) => s.time);
  const items = useSystemStore((s) => s.items);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.(".nav-datetime")) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  if (!open) return null;
  const shots = items.filter((i) => i.kind === "image").slice(-3).reverse();
  return (
    <aside
      ref={ref}
      aria-label="Notification Center"
      className="fixed bottom-4 right-3 top-[42px] z-[100001] flex w-[340px] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/15 p-3 font-sans text-white shadow-[0_18px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-right-6 duration-200"
      style={{ background: "rgba(30,30,30,0.72)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" }}
    >
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{dayjs(time).format("dddd")}</div>
          <div className="text-xl font-light">{dayjs(time).format("MMMM D")}</div>
        </div>
        <button
          type="button"
          onClick={() => toggle("focusMode")}
          aria-pressed={focus}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${focus ? "bg-indigo-500 text-white" : "bg-white/10 text-white/80 hover:bg-white/15"}`}
        >
          <Moon size={13} /> Do Not Disturb
        </button>
      </div>
      <div className="rounded-xl bg-white/8 p-3">
        <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-white/80">
          <Bell size={13} /> Notifications
        </div>
        {focus && <p className="text-[12px] text-white/55">Do Not Disturb is on. Notifications are silenced.</p>}
        {shots.length === 0 && !focus && <p className="text-[12px] text-white/55">No New Notifications</p>}
        {shots.map((s) => (
          <div key={s.id} className="mt-2 flex items-center gap-2 rounded-lg bg-white/8 p-2">
            {s.src ? <img src={s.src} alt="" className="h-9 w-14 rounded object-cover" /> : <span className="h-9 w-14 rounded bg-white/10" />}
            <div className="min-w-0">
              <div className="text-[12px] font-medium">Screenshot saved</div>
              <div className="truncate text-[10.5px] text-white/55">{s.name}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

const DockHotZone = () => {
  const on = useSystemStore((s) => s.dockAutohide);
  if (!on) return null;
  return <div className="dock-hotzone" aria-hidden="true" />;
};

const SystemLayer = () => {
  const dockAutohide = useSystemStore((s) => s.dockAutohide);
  useEffect(() => {
    document.body.classList.toggle("dock-autohide-on", dockAutohide);
    return () => document.body.classList.remove("dock-autohide-on");
  }, [dockAutohide]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.code === "Space") {
        e.preventDefault();
        useSystemStore.getState().requestSpotlight("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <WallpaperLayer />
      <DockHotZone />
      <NotificationCenter />
      <ScreenshotToast />
      <LockScreen />
    </>
  );
};

export default SystemLayer;
