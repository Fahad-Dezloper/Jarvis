import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, User } from "lucide-react";
import { WISPR_PATHS, WISPR_VIEWBOX } from "./wisprPaths";

const AUTO_ENTER_MS = 5000;
const FADE_MS = 500;
const STROKE_DELAY_S = 0.13;
const STROKE_DURATION_S = 0.95;

const formatTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const formatDate = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const LoginScreen = ({ onLogin }) => {
  const leavingRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [time, setTime] = useState(formatTime);
  const [dateStr, setDateStr] = useState(formatDate);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTime());
      setDateStr(formatDate());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Enter, Space or a click goes straight to the desktop; otherwise it enters on its own.
  const enter = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setTimeout(onLogin, FADE_MS);
  }, [onLogin]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") enter();
    };
    window.addEventListener("keydown", handleKeyDown);
    const auto = setTimeout(enter, AUTO_ENTER_MS);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(auto);
    };
  }, [enter]);

  return (
    <>
      <style>{`
        @keyframes drawWisprStroke {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        .wispr-stroke {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: drawWisprStroke ${STROKE_DURATION_S}s ease-in-out forwards;
        }
      `}</style>

      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/10 backdrop-blur-lg select-none py-12 px-6 cursor-pointer transition-opacity duration-500 ease-in-out ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
        onClick={enter}
      >
        <div className="flex flex-col items-center justify-between h-full w-full max-w-lg text-white">
          {/* Top lock and date/time */}
          <div className="flex flex-col items-center mt-6">
            <Lock className="w-5 h-5 text-white/90 mb-3" />
            <p className="text-white/90 text-lg font-medium tracking-wide drop-shadow-md">
              {dateStr}
            </p>
            <h1 className="text-white text-7xl sm:text-8xl font-light tracking-tighter drop-shadow-lg mt-1 select-text">
              {time}
            </h1>
          </div>

          {/* Animated handwriting */}
          <div className="flex-1 flex items-center justify-center py-10 w-full max-w-xl px-4 overflow-hidden">
            <svg
              viewBox={WISPR_VIEWBOX}
              className="w-full h-auto drop-shadow-[0_8px_24px_rgba(255,255,255,0.2)]"
              role="img"
              aria-label="wispr"
            >
              {WISPR_PATHS.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  pathLength="1"
                  stroke="white"
                  strokeWidth="9"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="wispr-stroke"
                  style={{ animationDelay: `${(0.2 + i * STROKE_DELAY_S).toFixed(2)}s` }}
                />
              ))}
            </svg>
          </div>

          {/* Bottom profile and prompt */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/20 shadow-md flex items-center justify-center">
              <User className="w-5 h-5 text-white/90" />
            </div>
            <div className="text-center">
              <p className="text-white/80 text-sm font-medium tracking-wide drop-shadow-sm animate-pulse">
                Press Enter or Click to continue
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-2 text-white/50 text-[11px]">
                <span>Press</span>
                <span className="bg-white/10 px-1.5 py-0.5 rounded border border-white/15 text-[10px] font-mono">
                  F11
                </span>
                <span>for Full Screen</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginScreen;
