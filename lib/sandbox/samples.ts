import type { ImportedSource } from "./templates";

export interface Sample {
  id: string;
  name: string;
  blurb: string;
  tech: string;
  sources: ImportedSource[];
}

const cssCardTsx = `export default function PulseCard() {
  return (
    <article className="pulse-card">
      <div className="pulse-card__icon">
        <span />
      </div>
      <h2>Launch ready</h2>
      <p>Everything shipped and the checks are green.</p>
      <div className="pulse-card__bar">
        <i />
      </div>
      <button>View release</button>
    </article>
  );
}
`;

const cssCardCss = `.pulse-card {
  width: 320px;
  padding: 28px;
  border-radius: 20px;
  background: linear-gradient(160deg, #1b1b2a, #12121b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: card-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both,
    card-glow 2.4s ease-in-out 700ms infinite;
}
.pulse-card__icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: #7c6cff;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  animation: icon-bounce 1.6s ease-in-out 900ms infinite;
}
.pulse-card__icon span {
  width: 20px;
  height: 10px;
  border-left: 3px solid #fff;
  border-bottom: 3px solid #fff;
  transform: rotate(-45deg) translate(1px, -2px);
}
.pulse-card h2 { margin: 0 0 6px; font-size: 20px; }
.pulse-card p { margin: 0 0 20px; color: #9a9ab0; font-size: 14px; line-height: 1.5; }
.pulse-card__bar {
  height: 6px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-bottom: 22px;
}
.pulse-card__bar i {
  display: block;
  height: 100%;
  width: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7c6cff, #5ee1c1, #7c6cff);
  background-size: 200% 100%;
  transform-origin: left;
  animation: bar-fill 1.4s ease-out 400ms both, shimmer 2s linear 1.8s infinite;
}
.pulse-card button {
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: #ececf3;
  color: #0b0b10;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease;
}
.pulse-card button:hover { transform: translateY(-2px); }

@keyframes card-in {
  from { opacity: 0; transform: translateY(40px) scale(0.94); }
  to { opacity: 1; transform: none; }
}
@keyframes card-glow {
  0%, 100% { box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 rgba(124, 108, 255, 0); }
  50% { box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 108, 255, 0.45); }
}
@keyframes icon-bounce {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
  60% { transform: translateY(0) scale(1.05, 0.95); }
}
@keyframes bar-fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
`;

const gsapTsx = `import { useEffect, useRef } from "react";
import gsap from "gsap";

const items = [
  { title: "Design tokens", meta: "12 updated" },
  { title: "Motion spec", meta: "3 comments" },
  { title: "Component audit", meta: "Due Friday" },
  { title: "Release notes", meta: "Draft" },
  { title: "Handoff review", meta: "Scheduled" },
];

export default function StaggerList() {
  const root = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
      tl.from(".row", {
        y: 36,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
      })
        .from(".dot", { scale: 0, duration: 0.4, stagger: 0.12, ease: "back.out(3)" }, 0.2)
        .to(".row", { x: 24, opacity: 0, duration: 0.45, stagger: 0.07, ease: "power2.in" }, "+=1.6");
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <ul ref={root} style={{ listStyle: "none", margin: 0, padding: 0, width: 340 }}>
      {items.map((item) => (
        <li
          key={item.title}
          className="row"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            marginBottom: 10,
            borderRadius: 14,
            background: "#16161f",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span className="dot" style={{ width: 10, height: 10, borderRadius: 99, background: "#5ee1c1" }} />
          <span style={{ flex: 1, fontWeight: 600 }}>{item.title}</span>
          <span style={{ color: "#8b8ba0", fontSize: 13 }}>{item.meta}</span>
        </li>
      ))}
    </ul>
  );
}
`;

const smilSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="220" height="220">
  <circle cx="60" cy="60" r="44" fill="none" stroke="#23232f" stroke-width="8" />
  <circle cx="60" cy="60" r="44" fill="none" stroke="#7c6cff" stroke-width="8" stroke-linecap="round"
    stroke-dasharray="276" stroke-dashoffset="276" transform="rotate(-90 60 60)">
    <animate attributeName="stroke-dashoffset" values="276;70;276" dur="2.4s" repeatCount="indefinite"
      calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
    <animateTransform attributeName="transform" type="rotate" from="-90 60 60" to="270 60 60"
      dur="2.4s" repeatCount="indefinite" />
  </circle>
  <g fill="#5ee1c1">
    <circle cx="60" cy="60" r="5">
      <animate attributeName="r" values="3;7;3" dur="1.2s" begin="0s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" begin="0s" repeatCount="indefinite" />
    </circle>
    <circle cx="44" cy="60" r="5">
      <animate attributeName="r" values="3;7;3" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
    </circle>
    <circle cx="76" cy="60" r="5">
      <animate attributeName="r" values="3;7;3" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
    </circle>
  </g>
</svg>
`;

export const SAMPLES: Sample[] = [
  {
    id: "css-card",
    name: "Pulse card",
    blurb: "CSS keyframes: entrance, glow, bounce, shimmer",
    tech: "CSS",
    sources: [
      { name: "PulseCard.tsx", code: cssCardTsx, kind: "react" },
      { name: "pulse-card.css", code: cssCardCss, kind: "css" },
    ],
  },
  {
    id: "gsap-list",
    name: "Stagger list",
    blurb: "GSAP timeline with staggered rows, looping",
    tech: "GSAP",
    sources: [{ name: "StaggerList.tsx", code: gsapTsx, kind: "react" }],
  },
  {
    id: "smil-loader",
    name: "SMIL loader",
    blurb: "SVG animate and animateTransform",
    tech: "SMIL",
    sources: [{ name: "loader.svg", code: smilSvg, kind: "svg" }],
  },
];
