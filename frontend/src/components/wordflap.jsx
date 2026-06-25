// A word-cycling split-flap board — the alphabetic sibling of SplitFlap. It
// shuffles letters and lands on a target word, then advances to the next on a
// timer, so the hero reads like a live departure board flipping through the
// categories the site covers. Words are padded to a fixed width so the board
// doesn't jump as the letters change.
import { useEffect, useRef, useState } from "react";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const prefersReduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function AlphaFlap({ target, index, gen, accent }) {
  const [ch, setCh] = useState(target);
  const [tick, setTick] = useState(0);
  const startedFor = useRef(null);

  useEffect(() => {
    const runId = `${target}|${gen}`;
    if (startedFor.current === runId) return;
    startedFor.current = runId;

    if (prefersReduce() || target === " ") { setCh(target); return; }

    const steps = 5 + index * 2; // tiles further right settle a beat later
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      if (k >= steps) { setCh(target); setTick((t) => t + 1); clearInterval(id); return; }
      setCh(ALPHA[(Math.random() * ALPHA.length) | 0]);
      setTick((t) => t + 1);
    }, 50);
    return () => clearInterval(id);
  }, [target, index, gen]);

  return (
    <span className={`flap flap-wide ${accent ? "flap-accent" : ""}`} aria-hidden="true">
      <span key={tick} className="flap-char">{ch === " " ? " " : ch}</span>
    </span>
  );
}

export function WordFlap({ words = [], interval = 2600, accent = false, className = "", style }) {
  const [i, setI] = useState(0);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const id = setInterval(() => {
      setI((p) => (p + 1) % words.length);
      setGen((g) => g + 1);
    }, interval);
    return () => clearInterval(id);
  }, [words, interval]);

  if (!words.length) return null;
  const maxLen = words.reduce((m, w) => Math.max(m, w.length), 0);
  const chars = (words[i] || "").toUpperCase().padEnd(maxLen, " ").split("");

  return (
    <span className={`inline-flex gap-[.1em] font-display font-semibold ${className}`}
      style={style} role="text" aria-label={words[i]}>
      {chars.map((c, idx) => <AlphaFlap key={idx} target={c} index={idx} gen={gen} accent={accent} />)}
    </span>
  );
}
