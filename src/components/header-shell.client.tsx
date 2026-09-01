"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";

/** Sticky header that slides away on scroll-down and returns on scroll-up. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (y < 80) setHidden(false);
      else if (dy > 6) setHidden(true);
      else if (dy < -6) setHidden(false);
      lastY.current = y;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "sticky top-0 z-[1200] border-b border-border bg-surface transition-transform duration-300 ease-out",
        hidden && "-translate-y-full",
      )}
    >
      {children}
    </header>
  );
}
