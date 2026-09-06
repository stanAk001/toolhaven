import { useEffect, useRef } from "react";

// InkField — a living newsprint halftone. A grid of ink dots breathes with a
// slow diagonal wave, and where your cursor passes the dots swell and bloom
// into the accent red, displaced outward like wet ink pushed across paper.
//
// Pure canvas, no dependencies. Animates only by repainting (no layout), caps
// the device-pixel-ratio for fill-rate, pauses itself while scrolled out of
// view, and falls back to one static frame under reduced-motion.
export function InkField({ className = "", gap = 17, ink = null, accent = null }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Resolve the dot colours from the live theme variables so the field follows
    // Day/Night, re-reading them whenever the theme attribute flips.
    const readVar = (name, fallback) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v ? `rgb(${v})` : fallback;
    };
    let inkColor = ink || readVar("--ink", "#0E1116");
    let accentColor = accent || readVar("--accent", "#1F5EFF");
    const themeObs = new MutationObserver(() => {
      inkColor = ink || readVar("--ink", "#0E1116");
      accentColor = accent || readVar("--accent", "#1F5EFF");
      if (reduce) staticFrame();
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let raf = 0, paused = false, w = 0, h = 0, dots = [];
    const pointer = { x: -9999, y: -9999, active: false };
    const REACH = 155; // px radius of the cursor's ink bloom

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width; h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = gap / 2; y < h; y += gap)
        for (let x = gap / 2; x < w; x += gap)
          dots.push({ x, y, phase: (x + y) * 0.016 });
    };

    const paintDot = (x, y, r, color, alpha) => {
      if (r < 0.2) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const frame = (t) => {
      if (paused) { raf = 0; return; }
      ctx.clearRect(0, 0, w, h);
      const time = t * 0.001;
      for (const d of dots) {
        let r = 1.2 + Math.sin(time * 1.15 + d.phase) * 0.95; // gentle breathing
        let ox = 0, oy = 0, color = inkColor, alpha = 0.17;
        if (pointer.active) {
          const dx = d.x - pointer.x, dy = d.y - pointer.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < REACH * REACH) {
            const dist = Math.sqrt(dist2) || 1;
            const f = 1 - dist / REACH;          // 0 at edge → 1 at cursor
            r += f * f * 4.8;                    // swell
            const push = f * f * 13;             // shove the ink outward
            ox = (dx / dist) * push;
            oy = (dy / dist) * push;
            if (f > 0.45) { color = accentColor; alpha = 0.28 + f * 0.5; }
            else { alpha = 0.17 + f * 0.32; }
          }
        }
        paintDot(d.x + ox, d.y + oy, r, color, alpha);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    const staticFrame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) paintDot(d.x, d.y, 1.2, inkColor, 0.17);
      ctx.globalAlpha = 1;
    };

    build();

    if (reduce) {
      staticFrame();
      const ro = new ResizeObserver(() => { build(); staticFrame(); });
      ro.observe(canvas);
      return () => { ro.disconnect(); themeObs.disconnect(); };
    }

    const start = () => { paused = false; if (!raf) raf = requestAnimationFrame(frame); };
    const stop = () => { paused = true; };

    // Track the cursor in viewport space, then map into the canvas. The canvas
    // itself stays pointer-events:none so links underneath remain clickable.
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e;
      const rect = canvas.getBoundingClientRect();
      pointer.x = p.clientX - rect.left;
      pointer.y = p.clientY - rect.top;
      pointer.active =
        pointer.x >= -REACH && pointer.x <= rect.width + REACH &&
        pointer.y >= -REACH && pointer.y <= rect.height + REACH;
    };
    const onLeave = () => { pointer.active = false; };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("blur", onLeave);

    const ro = new ResizeObserver(build);
    ro.observe(canvas);

    // Only burn frames while the field is actually on screen.
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? start() : stop()),
      { threshold: 0 }
    );
    io.observe(canvas);

    start();

    return () => {
      stop();
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObs.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("blur", onLeave);
    };
  }, [gap, ink, accent]);

  return <canvas ref={ref} className={className} aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }} />;
}
