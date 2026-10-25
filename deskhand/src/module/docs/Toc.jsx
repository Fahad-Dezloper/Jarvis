"use client";

import { useEffect, useState } from "react";

export default function Toc({ items }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const root = document.querySelector(".dh-docs");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-10% 0px -75% 0px" },
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="dh-toc" aria-label="Table of contents">
      <p>On this page</p>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className={active === item.id ? "is-active" : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
