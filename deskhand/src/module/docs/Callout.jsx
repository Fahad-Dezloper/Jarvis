const LABELS = {
  verified: "Verified",
  unverified: "Unverified",
  design: "Design",
  note: "Note",
};

export default function Callout({ kind = "note", title, children }) {
  return (
    <aside className={`dh-callout dh-callout-${kind}`}>
      <strong className="dh-callout-tag">{title || LABELS[kind]}</strong>
      <div>{children}</div>
    </aside>
  );
}
