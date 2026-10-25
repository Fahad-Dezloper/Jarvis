import { useEffect, useRef } from "react";
import gsap from "gsap";
import { onDeskhandEvent } from "./store";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function VirtualCursor() {
  const cursorRef = useRef(null);
  const rippleRef = useRef(null);
  const pos = useRef(null);
  const tl = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const ripple = rippleRef.current;
    if (!cursor || !ripple) return undefined;
    gsap.set(cursor, { autoAlpha: 0 });
    gsap.set(ripple, { autoAlpha: 0 });

    const off = onDeskhandEvent((e) => {
      if (e.type !== "step" || e.status !== "start" || !e.rect) return;
      const { x, y, width, height } = e.rect;
      if (![x, y, width, height].every(Number.isFinite) || (width <= 0 && height <= 0)) return;
      const tx = x + width / 2;
      const ty = y + height / 2;
      const reduced = prefersReducedMotion();
      const from = pos.current ?? { x: window.innerWidth / 2, y: window.innerHeight - 120 };

      tl.current?.kill();
      gsap.set(ripple, { autoAlpha: 0 });

      if (reduced) {
        gsap.set(cursor, { x: tx, y: ty, autoAlpha: 1 });
        pos.current = { x: tx, y: ty };
        tl.current = gsap.timeline().to(cursor, { autoAlpha: 0, duration: 0.2, delay: 0.5 });
        return;
      }

      gsap.set(cursor, { x: from.x, y: from.y, autoAlpha: 0 });
      tl.current = gsap
        .timeline()
        .to(cursor, { autoAlpha: 1, duration: 0.12 })
        .to(cursor, {
          x: tx,
          y: ty,
          duration: 0.4,
          ease: "power3.inOut",
          onUpdate: () => {
            pos.current = { x: gsap.getProperty(cursor, "x"), y: gsap.getProperty(cursor, "y") };
          },
          onComplete: () => {
            pos.current = { x: tx, y: ty };
          },
        })
        .fromTo(
          cursor.firstChild,
          { scale: 1 },
          { scale: 0.82, duration: 0.09, yoyo: true, repeat: 1 },
        )
        .fromTo(
          ripple,
          { x: tx, y: ty, scale: 0.2, autoAlpha: 0.7 },
          { scale: 1.6, autoAlpha: 0, duration: 0.55, ease: "power2.out" },
          "<",
        )
        .to(cursor, { autoAlpha: 0, duration: 0.35, delay: 0.25 });
    });

    return () => {
      off();
      tl.current?.kill();
    };
  }, []);

  return (
    <div className="dk-cursor-layer" aria-hidden="true">
      <div ref={rippleRef} className="dk-ripple" />
      <div ref={cursorRef} className="dk-cursor">
        <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
          <path
            d="M3 2.2v19.4l5.1-4.6 3.3 7.4 3.4-1.5-3.3-7.3 7.2-.4L3 2.2z"
            fill="#fff"
            stroke="#111"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
