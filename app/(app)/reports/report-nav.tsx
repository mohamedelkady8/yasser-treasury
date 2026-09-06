"use client";

import { useEffect, useState } from "react";

export type Section = { id: string; label: string };

/**
 * شريط تنقّل لاصق بين أقسام التقرير، يُبرز القسم الظاهر حاليًا.
 * مخفي عند الطباعة لأن الأقسام تكون كلها على الورق.
 */
export function ReportNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => Boolean(n));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="أقسام التقرير"
      className="scroll-slim sticky top-0 z-20 -mx-4 flex gap-1.5 overflow-x-auto border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 print:hidden"
    >
      {sections.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "true" : undefined}
          className={
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
            (active === s.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground")
          }
        >
          <span className="num opacity-60">{i + 1}</span>
          {s.label}
        </a>
      ))}
    </nav>
  );
}
