import { useEffect, useState } from "react";
import { User } from "lucide-react";

const AUTO_ENTER_MS = 3500;

const formatTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const formatDate = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const LoginScreen = ({ onLogin }) => {
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
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") onLogin();
    };
    window.addEventListener("keydown", handleKeyDown);
    const auto = setTimeout(onLogin, AUTO_ENTER_MS);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(auto);
    };
  }, [onLogin]);

  return (
    <>
      <style>{`
        @keyframes drawSvgPathHello {
          0% { stroke-dashoffset: -2000; opacity: 0; }
          10% { opacity: 1; }
          90% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        .svg-drawing-path-hello {
          stroke-dasharray: 2000;
          stroke-dashoffset: -2000;
          animation: drawSvgPathHello 2.5s ease-in-out forwards;
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/10 backdrop-blur-lg select-none py-12 px-6 cursor-pointer"
        onClick={onLogin}
      >
        <div className="flex flex-col items-center justify-between h-full w-full max-w-lg text-white">
          <div className="flex flex-col items-center mt-6">
            <p className="text-white/90 text-lg font-medium tracking-wide drop-shadow-md">
              {dateStr}
            </p>
            <h1 className="text-white text-7xl sm:text-8xl font-light tracking-tighter drop-shadow-lg mt-1">
              {time}
            </h1>
          </div>

          <div className="flex-1 flex items-center justify-center py-10 w-full max-w-xl px-4 overflow-hidden">
            <svg
              viewBox="0 0 512 342"
              className="w-full h-auto drop-shadow-[0_8px_24px_rgba(255,255,255,0.2)]"
            >
              <g transform="translate(256, 171)">
                <path
                  d="M210.25,1.907C191.75,22.382,184.25,11.881,159.25,2.516C122.234,-11.35,101.515,58.907,144.75,58.907C174.25,58.907,187.75,0.881,149.25,0.881C116.016,0.881,121.25,58.907,88.25,58.907C26.064,58.907,62.25,-63.593,88.25,-63.593C117.75,-63.593,82.75,58.907,31.75,58.907C-19.25,58.907,3.75,-63.593,29.75,-63.593C59.75,-63.593,33.25,58.907,-27.75,58.907C-69.25,58.907,-65.75,1.907,-36.25,1.907C-6.75,1.907,-62.313,81.381,-92.25,61.381C-110.25,49.356,-80.25,1.907,-111.25,1.907C-142.25,1.907,-143.25,51.286,-145.25,66.119C-137.25,-44.119,-125.75,-66.119,-107.75,-66.119C-89.75,-66.119,-94.275,-37.834,-107.75,-19.119C-129.258,10.754,-153.75,32.381,-210.25,47.881"
                  stroke="white"
                  strokeWidth="9"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="svg-drawing-path-hello"
                />
              </g>
            </svg>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/20 shadow-md flex items-center justify-center">
              <User className="w-5 h-5 text-white/90" />
            </div>
            <p className="text-white text-sm font-semibold drop-shadow-sm">Guest</p>
            <p className="text-white/80 text-sm font-medium tracking-wide drop-shadow-sm animate-pulse">
              Press Enter or click to continue
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginScreen;
