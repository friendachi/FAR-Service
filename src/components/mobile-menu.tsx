"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The phone "☰" menu. A plain <details> stays open after a client-side navigation because the
 * header never unmounts, so close it when a link inside is tapped, when the route changes,
 * when tapping outside it, and on Escape.
 */
export function MobileMenu({ summary, children, className }: { summary: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    // Scrolling the page also closes it, so the open menu never sits over the content.
    const startY = { v: 0 };
    const onToggle = () => { startY.v = window.scrollY; };
    const onScroll = () => {
      const d = ref.current;
      if (d?.open && Math.abs(window.scrollY - startY.v) > 24) d.open = false;
    };
    const d = ref.current;
    d?.addEventListener("toggle", onToggle);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      d?.removeEventListener("toggle", onToggle);
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <details
      ref={ref}
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a") && ref.current) ref.current.open = false;
      }}
    >
      {summary}
      {children}
    </details>
  );
}
