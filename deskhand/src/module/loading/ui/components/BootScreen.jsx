import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState, useEffect } from "react";

const OrryMark = ({ size }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className="drop-shadow-[0_0_24px_rgba(139,124,255,0.55)]">
    <defs>
      <linearGradient id="orryBootGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8b7cff" />
        <stop offset="1" stopColor="#4fd8c4" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#orryBootGradient)" />
    <circle cx="32" cy="32" r="14" fill="none" stroke="#fff" strokeWidth="8" />
  </svg>
);

const BootScreen = ({ onComplete, isMobile: propIsMobile }) => {
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const [isMobile, setIsMobile] = useState(propIsMobile);

  useEffect(() => {
    setIsMobile(propIsMobile);
  }, [propIsMobile]);

  useEffect(() => {
    if (propIsMobile === undefined && typeof window !== "undefined") {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, [propIsMobile]);

  useGSAP(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(containerRef.current, {
          opacity: 0,
          duration: 0.6,
          ease: "power2.inOut",
          onComplete: onComplete,
        });
      },
    });

    if (isMobile) {
      // Simulate the iPhone boot delay
      tl.to(
        {},
        {
          duration: 1.2,
          delay: 0.2,
        },
      );
    } else {
      // Simulate the Mac boot progress bar
      tl.to(progressRef.current, {
        width: "100%",
        duration: 1.0,
        ease: "power1.inOut",
        delay: 0.2,
      });
    }
  }, [isMobile]);

  if (isMobile) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-99999 bg-[#05060f] flex flex-col items-center justify-center py-12 px-6 select-none overflow-hidden"
      >
        {/* Orry mark (centered) */}
        <div className="flex flex-col items-center justify-center flex-1 w-full">
          <div className="relative">
            <OrryMark size={72} />
          </div>
        </div>
      </div>
    );
  }

  // Desktop Boot Screen (Classic Mac Style)
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-99999 bg-[#05060f] flex flex-col items-center justify-center gap-16"
    >
      <OrryMark size={72} />
      <div className="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div ref={progressRef} className="h-full rounded-full w-0 bg-gradient-to-r from-[#8b7cff] to-[#4fd8c4]" />
      </div>
    </div>
  );
};

export default BootScreen;
