"use client";

import { useState } from "react";

export default function CodeBlock({ code, lang = "text", title }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className="dh-code">
      <figcaption>
        <span>{title || lang}</span>
        <button type="button" onClick={copy} aria-label="Copy code to clipboard">
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
