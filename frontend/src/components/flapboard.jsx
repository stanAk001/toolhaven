// The departure board.
//
// A real split-flap, tile by tile. Each tile owns two characters at once — the
// one leaving and the one arriving — and folds between them in two stages: the
// outgoing top half drops onto the seam, then the incoming bottom half swings up
// from behind it. Nothing spins on its own axis, which is the difference between
// machinery and a CSS trick.
//
// The board shuffles through the alphabet before it settles, and columns further
// right take more steps to land, so the word resolves left to right the way a
// real board does when the drums are released together but stop in sequence.
import { Fragment, useEffect, useMemo, useState } from "react";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WIDE = /[MW]/;          // these two need a broader tile
const STEP_MS = 55;           // one drum click
const SETTLE_BASE = 4;        // clicks before the first column lands
const SETTLE_STAGGER = 2;     // extra clicks per column to the right

/* One tile. It holds `prev` and `cur` itself so a re-render can't interrupt a
   fold half-way; the leaves unmount only once the up-swing has actually ended. */
function Tile({ ch }) {
  const [s, setS] = useState({ prev: ch, cur: ch, n: 0 });

  useEffect(() => {
    setS((p) => (p.cur === ch ? p : { prev: p.cur, cur: ch, n: p.n + 1 }));
  }, [ch]);

  const folding = s.prev !== s.cur;

  return (
    <span className={`fb-tile ${WIDE.test(s.cur) || WIDE.test(s.prev) ? "fb-tile--wide" : ""}`}>
      {/* the halves already at rest: top is the new card, bottom the old one */}
      <span className="fb-half fb-top"><span>{s.cur}</span></span>
      <span className="fb-half fb-bottom"><span>{s.prev}</span></span>

      {folding && (
        <Fragment key={s.n}>
          <span className="fb-half fb-top fb-fold-down"><span>{s.prev}</span></span>
          <span className="fb-half fb-bottom fb-fold-up"
            onAnimationEnd={() => setS((p) => ({ ...p, prev: p.cur }))}>
            <span>{s.cur}</span>
          </span>
        </Fragment>
      )}
    </span>
  );
}

export function FlapBoard({ words = [], interval = 2600, className = "" }) {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // every word is padded to the longest, so the board never changes width
  const width = useMemo(
    () => words.reduce((m, w) => Math.max(m, w.length), 0),
    [words],
  );
  const target = useMemo(
    () => (words[i] || "").toUpperCase().padEnd(width, " "),
    [words, i, width],
  );

  const [chars, setChars] = useState(() => target.split(""));

  // shuffle, then land column by column
  useEffect(() => {
    if (reduced) { setChars(target.split("")); return; }
    const cols = target.split("");
    const lands = cols.map((_, c) => SETTLE_BASE + c * SETTLE_STAGGER);
    const last = Math.max(...lands, 0);
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      setChars(cols.map((t, c) => (k >= lands[c] ? t : ALPHA[(Math.random() * ALPHA.length) | 0])));
      if (k >= last) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [target, reduced]);

  // advance to the next word
  useEffect(() => {
    if (reduced || words.length < 2) return;
    const id = setInterval(() => setI((p) => (p + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [reduced, words.length, interval]);

  if (!words.length) return null;

  // Reduced motion: the board is struck and stays struck — the full beat listed
  // plainly, nothing folding.
  if (reduced) {
    return (
      <p className={`font-mono text-micro uppercase tracking-[.16em] text-ink2 ${className}`}>
        <span className="text-accentDeep">Now showing</span>
        <span aria-hidden="true" className="text-accent px-2.5">→</span>
        {words.join("  ·  ")}
      </p>
    );
  }

  return (
    <p className={`flex items-center gap-3 font-mono text-micro uppercase tracking-[.16em] ${className}`}>
      <span className="text-accentDeep shrink-0">Now showing</span>
      <span aria-hidden="true" className="text-accent shrink-0">→</span>

      <span className="fb font-display font-semibold shrink-0"
        style={{ fontSize: "clamp(15px,2.1vw,22px)" }}
        role="img" aria-label={`Now showing: ${words[i]}`}>
        {chars.map((c, n) => <Tile key={n} ch={c} />)}
      </span>

      {/* the counter is the first thing to go on a narrow screen: the label, the
          board and the blanks all have to fit before it earns its 40px */}
      <span aria-hidden="true" className="hidden sm:inline text-ink2/60 tabular-nums shrink-0">
        {String(i + 1).padStart(2, "0")}/{String(words.length).padStart(2, "0")}
      </span>
    </p>
  );
}
