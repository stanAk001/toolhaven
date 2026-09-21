/**
 * A moving backdrop for a buying guide, drawn rather than filmed.
 *
 * The brief was video: a laptop opening, specs flying past. Stock footage was
 * the wrong tool for it. A single clip is megabytes against a page that is
 * currently kilobytes, it is the one asset on the site that cannot be checked
 * for licensing, and video behind text is the reliable way to make text hard to
 * read. So each subject gets a drawn loop instead — a few hundred bytes of SVG
 * moved by CSS transforms, which costs nothing, cannot be mis-licensed, and can
 * be tuned to sit far enough back that the words still win.
 *
 * The drifting chips are deliberately blank bars rather than "16 GB" or "4K".
 * A number on a page is a claim, and these are decoration behind a heading —
 * nothing here has been measured. They read as specifications moving past
 * without asserting a single one.
 *
 * Everything animates transform and opacity only, so it composites on the GPU
 * and never triggers layout. Under prefers-reduced-motion the whole thing holds
 * still, which is why each loop is drawn to look deliberate when frozen.
 */

/** Work out what a guide is about from its title and category. */
export function subjectOf(text = "") {
  const t = String(text).toLowerCase();
  if (/\blaptop|notebook|macbook|ultrabook/.test(t)) return "laptop";
  if (/\bkeyboard|keycap|mechanical\b/.test(t)) return "keyboard";
  if (/\bwebcam|camera\b/.test(t)) return "webcam";
  if (/\bmonitor|display|screen\b/.test(t)) return "monitor";
  if (/\bmouse|mice|trackpad|trackball/.test(t)) return "mouse";
  if (/\bheadset|headphone|earbud/.test(t)) return "headset";
  if (/\bmic\b|microphone|podcast/.test(t)) return "microphone";
  if (/\bdesk|chair|stand|arm\b/.test(t)) return "desk";
  if (/\bdock|hub\b/.test(t)) return "dock";
  return "default";
}

/** The chips that drift up past the object. Widths vary so they read as data. */
function Chips({ rows = [[14, 0], [22, 1.1], [10, 2.3], [18, 3.1]] }) {
  return (
    <g className="gm-chips">
      {rows.map(([w, delay], i) => (
        <rect key={i} className="gm-chip" x={92 + (i % 2) * 14} y={26 + i * 13}
          width={w} height="4" rx="2" style={{ animationDelay: `${delay}s` }} />
      ))}
    </g>
  );
}

function Laptop() {
  return (
    <>
      {/* The lid turns on the hinge, so the whole object reads as opening
          rather than as a picture that happens to move. */}
      <g className="gm-lid">
        <rect x="18" y="16" width="62" height="42" rx="3" />
        <rect x="24" y="22" width="50" height="30" rx="2" className="gm-screen" />
      </g>
      <path d="M12 60 h74 l6 8 H6 Z" />
      <Chips />
    </>
  );
}

function Keyboard() {
  // Three rows of caps. Each lights in turn, so a hand appears to be typing
  // across the board rather than every key blinking at once.
  const caps = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      caps.push(
        <rect key={`${r}-${c}`} className="gm-key"
          x={14 + c * 9} y={28 + r * 11} width="7" height="8" rx="1.5"
          style={{ animationDelay: `${(c * 0.12 + r * 0.06).toFixed(2)}s` }} />,
      );
    }
  }
  return (
    <>
      <rect x="9" y="23" width="88" height="40" rx="4" />
      {caps}
      <Chips rows={[[16, 0.4], [10, 1.6], [20, 2.7]]} />
    </>
  );
}

function Webcam() {
  return (
    <>
      <circle cx="46" cy="44" r="24" />
      <circle cx="46" cy="44" r="15" className="gm-iris" />
      <circle cx="46" cy="44" r="7" className="gm-iris" style={{ animationDelay: ".6s" }} />
      {/* the scan, travelling down the lens */}
      <rect className="gm-scan" x="22" y="44" width="48" height="1.5" rx="1" />
      <Chips rows={[[18, 0.2], [12, 1.4], [22, 2.6]]} />
    </>
  );
}

function Monitor() {
  return (
    <>
      <rect x="10" y="18" width="76" height="46" rx="3" />
      <path d="M40 64 h16 l3 10 H37 Z" />
      {/* a refresh sweeping the panel */}
      <rect className="gm-sweep" x="10" y="18" width="12" height="46" />
      <Chips rows={[[20, 0], [12, 1.2], [16, 2.4]]} />
    </>
  );
}

function Mouse() {
  return (
    <>
      <rect className="gm-hover" x="30" y="18" width="34" height="50" rx="17" />
      <line x1="47" y1="18" x2="47" y2="36" />
      <Chips rows={[[14, 0.3], [20, 1.5], [10, 2.6]]} />
    </>
  );
}

function Headset() {
  return (
    <>
      <path d="M20 46 a26 26 0 0 1 52 0" />
      <rect className="gm-hover" x="12" y="44" width="14" height="22" rx="6" />
      <rect className="gm-hover" x="66" y="44" width="14" height="22" rx="6"
        style={{ animationDelay: ".9s" }} />
      <Chips rows={[[16, 0.5], [22, 1.7]]} />
    </>
  );
}

function Microphone() {
  return (
    <>
      <rect x="36" y="14" width="22" height="34" rx="11" />
      <path d="M26 42 a21 21 0 0 0 42 0" />
      <line x1="47" y1="63" x2="47" y2="72" />
      {/* level bars, rising and falling like a meter */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} className="gm-level" x={74 + i * 7} y="40" width="4" height="18" rx="2"
          style={{ animationDelay: `${(i * 0.18).toFixed(2)}s` }} />
      ))}
    </>
  );
}

function Desk() {
  return (
    <>
      {/* the surface rises and settles, the way a sit-stand desk does */}
      <g className="gm-rise">
        <rect x="14" y="30" width="68" height="4" rx="2" />
        <line x1="24" y1="34" x2="24" y2="66" />
        <line x1="72" y1="34" x2="72" y2="66" />
      </g>
      <line x1="10" y1="70" x2="86" y2="70" />
      <Chips rows={[[18, 0.6], [12, 1.9]]} />
    </>
  );
}

function Dock() {
  return (
    <>
      <rect x="16" y="36" width="64" height="16" rx="4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} className="gm-key" x={24 + i * 11} y="41" width="7" height="6" rx="1"
          style={{ animationDelay: `${(i * 0.2).toFixed(2)}s` }} />
      ))}
      <Chips rows={[[20, 0.2], [14, 1.5], [18, 2.8]]} />
    </>
  );
}

function Default() {
  return (
    <>
      <rect className="gm-hover" x="24" y="24" width="46" height="36" rx="4" />
      <Chips />
    </>
  );
}

const SHAPES = {
  laptop: Laptop, keyboard: Keyboard, webcam: Webcam, monitor: Monitor,
  mouse: Mouse, headset: Headset, microphone: Microphone, desk: Desk,
  dock: Dock, default: Default,
};

/**
 * @param {string} subject  a key from SHAPES, usually via subjectOf()
 * @param {"card"|"hero"} intensity  how far back it sits
 */
export function GuideMotion({ subject = "default", intensity = "card", className = "", tint }) {
  const Shape = SHAPES[subject] || Default;
  return (
    <span aria-hidden="true"
      className={`gm gm-${intensity} pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={tint ? { color: tint } : undefined}>
      <svg viewBox="0 0 130 88"
        preserveAspectRatio={intensity === "hero" ? "xMaxYMid slice" : "xMidYMid slice"}
        className="w-full h-full" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <Shape />
      </svg>
    </span>
  );
}
