// Architecture diagram as inline SVG. Colors come from CSS variables in docs.css
// so it reads on the dark glass theme.

const Box = ({ x, y, w = 150, h = 54, title, sub, tone = "base" }) => (
  <g className={`dg-box dg-${tone}`}>
    <rect x={x} y={y} width={w} height={h} rx="12" />
    <text x={x + w / 2} y={y + (sub ? 22 : h / 2 + 5)} textAnchor="middle" className="dg-title">
      {title}
    </text>
    {sub && (
      <text x={x + w / 2} y={y + 40} textAnchor="middle" className="dg-sub">
        {sub}
      </text>
    )}
  </g>
);

const Arrow = ({ d, dashed }) => (
  <path d={d} className={dashed ? "dg-arrow dg-dashed" : "dg-arrow"} markerEnd="url(#dg-head)" />
);

export default function Diagram() {
  return (
    <figure className="dh-diagram">
      <svg
        viewBox="0 0 960 470"
        role="img"
        aria-label="Orry architecture: dictation feeds a launcher input, context providers and a planner produce a plan, a policy and consent gate approves it, executors run it, and results go to feedback and an audit log."
      >
        <defs>
          <marker
            id="dg-head"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" className="dg-head" />
          </marker>
        </defs>

        <text x="20" y="26" className="dg-lane">
          1 . Capture
        </text>
        <Box x={20} y={40} title="Dictation" sub="Wispr Flow (user's app)" tone="ext" />
        <Box x={20} y={130} title="Launcher input" sub="focused text field" tone="core" />
        <Arrow d="M95 94 L95 128" />

        <text x="230" y="26" className="dg-lane">
          2 . Understand
        </text>
        <Box
          x={230}
          y={40}
          title="Context providers"
          sub="app, tabs, clipboard, windows"
          tone="core"
        />
        <Box x={230} y={130} title="Planner" sub="model, structured output" tone="model" />
        <Arrow d="M170 157 L228 157" />
        <Arrow d="M305 94 L305 128" />

        <text x="440" y="26" className="dg-lane">
          3 . Decide
        </text>
        <Box
          x={440}
          y={130}
          title="Policy + consent gate"
          sub="risk tier, allowlist, preview"
          tone="gate"
        />
        <Arrow d="M380 157 L438 157" />

        <text x="650" y="26" className="dg-lane">
          4 . Act
        </text>
        <Box x={650} y={40} title="AppleScript" sub="osascript, System Events" tone="exec" />
        <Box
          x={650}
          y={130}
          title="Claude Code headless"
          sub="claude -p, scoped tools"
          tone="exec"
        />
        <Box x={650} y={220} title="App APIs" sub="Notion, others" tone="exec" />
        <Arrow d="M590 150 L648 72" />
        <Arrow d="M590 157 L648 157" />
        <Arrow d="M590 164 L648 245" />

        <Box x={650} y={330} title="Result + feedback" sub="text, audio, overlay" tone="core" />
        <Box x={440} y={330} title="Audit log" sub="local, append-only" tone="core" />
        <Arrow d="M725 274 L725 328" />
        <Arrow d="M650 357 L592 357" dashed />
        <Arrow d="M515 184 L515 328" dashed />

        <Box x={230} y={330} title="Kill switch" sub="halts gate + executors" tone="gate" w={160} />

        <text x="20" y="440" className="dg-note">
          Solid arrows: data flow. Dashed: results, approvals and logging. The model only ever sees
          the Planner box.
        </text>
      </svg>
    </figure>
  );
}
