// Route sweep — a restrained editorial cue on navigation: a thin accent press
// rule wipes left-to-right just beneath the header, like a press roller laying
// a line, then the page settles in. No full-screen veil; nothing cinematic.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export function RouteSweep() {
  const { pathname } = useLocation();
  const [run, setRun] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setRun((r) => r + 1);
  }, [pathname]);

  if (run === 0) return null;

  return (
    <div key={run} className="routesweep fixed inset-x-0 z-[55] pointer-events-none" aria-hidden="true">
      <span className="routesweep-bar" />
    </div>
  );
}
