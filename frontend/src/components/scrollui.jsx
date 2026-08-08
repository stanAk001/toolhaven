// Page-level chrome: a hairline reading meter that fills as you move down the
// page, and a back-to-top dial that rises once you're deep enough to want it.
import { useEffect, useState } from "react";
import { useScrolled } from "./motion.jsx";

export function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setPct(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div className="fixed top-0 inset-x-0 z-[60] h-[3px] pointer-events-none" aria-hidden="true">
      <div className="h-full bg-accent will-change-[width]"
        style={{ width: `${pct}%`, transition: "width .12s linear" }} />
    </div>
  );
}

export function BackToTop() {
  const show = useScrolled(420);
  return (
    // z-20 keeps the dial under the mobile menu panel (z-30); at z-40 it tied
    // with the header and floated on top of the open menu
    <button type="button" aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`lift fixed right-5 sm:right-6 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 grid place-items-center w-12 h-12 rounded-full bg-ink text-paper border-2 border-ink
        transition-all duration-300 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
      style={{ boxShadow: "3px 3px 0 #E8431F" }}>
      <span className="text-lg leading-none">↑</span>
    </button>
  );
}
