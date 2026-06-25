import { useEffect, useRef, useState } from "react";

// Watches an element and flips on a `.in` class the first time it scrolls into
// view, which is what kicks off the reveal/draw animations in index.css. We
// disconnect right after so nothing re-animates on the way back up the page.
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// Fades + lifts its contents into place as you reach them. Set `stagger` to deal
// the direct children out one after another instead of all together.
export function Reveal({ children, as: Tag = "div", stagger = false, className = "", ...rest }) {
  const [ref, inView] = useInView();
  const motion = stagger ? "stagger" : "reveal";
  return (
    <Tag ref={ref} className={`${motion} ${inView ? "in" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// CountUp — tallies a number up from zero with an ease-out the first time it's
// on screen, like a ledger totalling itself. Re-runs if the target changes (so
// it animates once async data arrives). Honors reduced-motion by showing the
// final figure immediately.
export function CountUp({ value = 0, duration = 1400, suffix = "", className = "" }) {
  const [ref, inView] = useInView(0.3);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(value); return; }
    let raf, start;
    const step = (t) => {
      start ??= t;
      const p = Math.min((t - start) / duration, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3)))); // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return <span ref={ref} className={className}>{n}{suffix}</span>;
}

// True once the page has scrolled past `threshold` — used to give the sticky
// header its floating shadow only after you've left the very top.
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

// An endless editorial ticker. We render the list twice so that when the track
// has slid exactly one copy to the left, it lines back up seamlessly. Hover to
// pause and actually read it.
export function Marquee({ items, sep = "✦", className = "" }) {
  const run = [...items, ...items];
  return (
    <div className={`marquee ${className}`} aria-hidden="true">
      <div className="marquee-track">
        {run.map((text, i) => (
          <span key={i} className="marquee-item inline-flex items-center gap-6">
            {text}<span className="opacity-50">{sep}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Tilt — gives a card real depth: it pitches in 3D toward the cursor, so the
// printed tile (and its offset shadow) leans off the page like something you've
// nudged with a fingertip, then springs flat when you leave. Disabled entirely
// under reduced-motion. The card's own hover lift composes on top, since this
// only rotates the wrapper.
export function Tilt({ children, className = "", max = 10 }) {
  const rotor = useRef(null);

  // The outer div is the perspective "scene"; the inner `rotor` is what actually
  // pitches. Keeping perspective on a parent (not baked into the rotor's own
  // transform) is what lets the card's inner layers sit at real Z-depths and
  // parallax against each other as it tilts.
  const move = (e) => {
    if (!rotor.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotor.current.style.transform = `rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
  };
  const reset = () => { if (rotor.current) rotor.current.style.transform = ""; };

  return (
    <div className={className} onMouseMove={move} onMouseLeave={reset} style={{ perspective: "1000px" }}>
      <div ref={rotor} className="h-full"
        style={{ transformStyle: "preserve-3d", transition: "transform .3s cubic-bezier(.2,.8,.2,1)", willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}

// The little hand-sketched stroke that draws itself under the hero's accent
// words once they're on screen.
export function DrawUnderline({ className = "" }) {
  const [ref, inView] = useInView(0.4);
  return (
    <svg ref={ref} className={`draw ${inView ? "in" : ""} ${className}`}
      viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 11 C 60 4, 120 5, 158 8 C 205 12, 255 6, 296 9" />
    </svg>
  );
}
