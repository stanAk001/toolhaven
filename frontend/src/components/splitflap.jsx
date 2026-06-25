import { useEffect, useRef, useState } from "react";

// A split-flap board — numbers that clatter into place like a station/newsroom
// departure board. Each character is its own tile that shuffles through glyphs
// and lands on its target, cells further right settling a beat later so the
// figure "spins up" left-to-right. Pure state + CSS, no dependencies.

const GLYPHS = "0123456789%$+";
const prefersReduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Flap({ target, index, accent, gen = 0 }) {
  const [ch, setCh] = useState(target);
  const [tick, setTick] = useState(0); // bumping this re-keys the glyph so the flip animation replays
  const startedFor = useRef(null);

  useEffect(() => {
    // re-run the shuffle when the real target changes (async data) OR when the
    // live cadence bumps `gen` — so the board keeps ticking over like it's live.
    const runId = `${target}|${gen}`;
    if (startedFor.current === runId) return;
    startedFor.current = runId;

    if (prefersReduce()) { setCh(target); return; }

    const steps = 7 + index * 3;           // right-hand tiles settle later
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      if (k >= steps) {
        setCh(target);
        setTick((t) => t + 1);
        clearInterval(id);
        return;
      }
      setCh(GLYPHS[(Math.random() * GLYPHS.length) | 0]);
      setTick((t) => t + 1);
    }, 55);
    return () => clearInterval(id);
  }, [target, index, gen]);

  return (
    <span className={`flap ${accent ? "flap-accent" : ""}`} aria-hidden="true">
      <span key={tick} className="flap-char">{ch}</span>
    </span>
  );
}

// `live` makes the board re-tick on an interval, so a figure that doesn't change
// still feels perpetually updated — like a board being refreshed on the hour.
export function SplitFlap({ value, accent = false, live = false, interval = 6000, className = "", style }) {
  const [gen, setGen] = useState(0);
  useEffect(() => {
    if (!live || prefersReduce()) return;
    const id = setInterval(() => setGen((g) => g + 1), interval);
    return () => clearInterval(id);
  }, [live, interval]);

  const str = String(value);
  return (
    <span className={`inline-flex gap-[.1em] font-display font-semibold ${className}`}
      style={style} role="text" aria-label={str}>
      {str.split("").map((c, i) => <Flap key={i} target={c} index={i} accent={accent} gen={gen} />)}
    </span>
  );
}
