import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { Caveat } from "next/font/google";

const script = Caveat({ weight: "700", subsets: ["latin"], display: "swap" });

const AUTO_ENTER_MS = 3500;
const FADE_MS = 500;

const formatTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const formatDate = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const LoginScreen = ({ onLogin }) => {
  const leavingRef = useRef(false);
  const [time, setTime] = useState(formatTime);
  const [dateStr, setDateStr] = useState(formatDate);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTime());
      setDateStr(formatDate());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Enter, Space or click goes straight to the desktop; otherwise enter automatically.
  const [leaving, setLeaving] = useState(false);
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
        @keyframes orryWrite {
          0% { stroke-dashoffset: 1600; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes orryWipe {
          0% { clip-path: inset(-10% 100% -10% 0); }
          100% { clip-path: inset(-10% -2% -10% 0); }
        }
        @keyframes orryFill {
          0% { fill-opacity: 0; }
          100% { fill-opacity: 1; }
        }
        @keyframes orryTagline {
          0% { opacity: 0; transform: translateY(6px); letter-spacing: 0.3em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.22em; }
        }
        .orry-word-wrap { animation: orryWipe 2.3s cubic-bezier(0.45, 0.05, 0.4, 1) 0.1s both; }
        .orry-word {
          stroke: #f4f2ff;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: #f4f2ff;
          fill-opacity: 0;
          stroke-dasharray: 1600;
          stroke-dashoffset: 1600;
          animation:
            orryWrite 2.3s ease-in-out 0.1s forwards,
            orryFill 0.6s ease-out 1.9s forwards;
        }
        .orry-tagline { opacity: 0; animation: orryTagline 0.9s ease-out 2.6s forwards; }
      `}</style>
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-between select-none py-12 px-6 cursor-pointer transition-opacity duration-500 ease-in-out ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
        style={{ background: "rgba(5, 6, 15, 0.38)", backdropFilter: "blur(10px)" }}
        onClick={enter}
      >
        <div className="flex flex-col items-center justify-between h-full w-full max-w-lg text-white">
          <div className="flex flex-col items-center mt-6">
            <p className="text-white/85 text-lg font-medium tracking-wide drop-shadow-md">
              {dateStr}
            </p>
            <h1 className="text-white text-7xl sm:text-8xl font-light tracking-tighter drop-shadow-lg mt-1">
              {time}
            </h1>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-10 w-full max-w-xl px-4 overflow-visible">
            <div className="orry-word-wrap w-full">
              <svg
                viewBox="0 0 640 260"
                className="w-full h-auto overflow-visible"
                style={{ filter: "drop-shadow(0 0 14px rgba(139,124,255,0.55)) drop-shadow(0 0 32px rgba(79,216,196,0.25))" }}
                role="img"
                aria-label="Wispr"
              >
                <text
                  x="320"
                  y="195"
                  textAnchor="middle"
                  fontSize="250"
                  className="orry-word"
                  style={{ fontFamily: script.style.fontFamily }}
                >
                  Wispr
                </text>
              </svg>
            </div>
            <p className="orry-tagline mt-2 text-sm uppercase text-white/70 font-medium">
              Say what you want.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full orry-lock-avatar border border-white/20 flex items-center justify-center">
              <User className="w-5 h-5 text-white/90" />
            </div>
            <p className="text-white text-sm font-semibold drop-shadow-sm">Guest</p>
            <p className="orry-lock-hint text-sm font-medium tracking-wide drop-shadow-sm animate-pulse">
              Press Enter or click to continue
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginScreen;
