import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { getCategories, subscribe } from "../api/client.js";
import { ThemeToggle } from "./theme.jsx";
import { useScrolled, Reveal } from "./motion.jsx";

const NAV = [
  ["/tools", "All tools"],
  ["/compare", "Compare"],
  ["/stacks", "Stacks"],
  ["/blog", "Blog"],
  ["/about", "About"],
  ["/contact", "Contact"],
];

// A single nav link, set in the display serif. Its text flips to paper while the
// sliding ink pill (owned by the parent nav) is beneath it; the active page sits
// in italic.
function NavItem({ to, label, innerRef, onEnter }) {
  return (
    <NavLink to={to} ref={innerRef} onMouseEnter={onEnter}
      className={({ isActive }) =>
        `relative z-10 px-4 py-2 font-display text-[17px] font-medium leading-none transition-colors duration-200 ${isActive ? "text-white italic" : "text-ink hover:text-white"}`}>
      {label}
    </NavLink>
  );
}

// The desktop nav, with one ink pill that slides between the links — following
// the cursor as you move across, and settling back under the active page when
// you leave. The pill's position is measured from the real DOM nodes.
function DesktopNav() {
  const navRef = useRef(null);
  const items = useRef({});
  const loc = useLocation();
  const [bar, setBar] = useState({ left: 0, width: 0, on: false });

  const activeTo = (NAV.find(([to]) => loc.pathname === to || loc.pathname.startsWith(to + "/")) || [])[0];

  const moveTo = (el) => {
    if (!el || !navRef.current) return;
    const navBox = navRef.current.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setBar({ left: box.left - navBox.left, width: box.width, on: true });
  };
  const settle = () => {
    const el = activeTo ? items.current[activeTo] : null;
    if (el) moveTo(el); else setBar((b) => ({ ...b, on: false }));
  };
  // re-settle under the active page on navigation (and on first paint)
  useEffect(settle, [loc.pathname]);

  return (
    <nav ref={navRef} onMouseLeave={settle} className="hidden md:flex items-center gap-1 relative">
      <span aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-full bg-accent transition-[left,width,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ left: bar.left, width: bar.width, opacity: bar.on ? 1 : 0 }} />
      {NAV.map(([to, label]) => (
        <NavItem key={to} to={to} label={label}
          innerRef={(el) => { items.current[to] = el; }}
          onEnter={(e) => moveTo(e.currentTarget)} />
      ))}
    </nav>
  );
}

export function Navbar() {
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const scrolled = useScrolled(8);
  useEffect(() => { getCategories().then(setCats).catch(() => {}); }, []);
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <header className={`border-b-2 border-ink sticky top-0 z-40 transition-all duration-300 ${scrolled ? "nav-scrolled bg-paper/80 supports-[backdrop-filter]:bg-paper/70 backdrop-blur-md" : "bg-paper"}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-2">
        <Link to="/" className="group font-mono font-bold tracking-[.18em] sm:tracking-[.2em] text-base sm:text-lg inline-flex items-center min-h-touch">
          TOOLHAVEN
          <span className="ml-1 text-accent transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125">✦</span>
        </Link>
        <div className="flex items-center gap-2">
          <DesktopNav />
          {/* the index — opens the ⌘K command palette */}
          <button type="button" onClick={() => window.dispatchEvent(new Event("toolhaven:search"))}
            aria-label="Search (Ctrl or Cmd + K)"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-paper px-3 min-h-touch min-w-touch transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: "2px 2px 0 var(--shadow-cast)" }}>
            <Search size={15} strokeWidth={2.5} aria-hidden="true" />
            <span className="hidden lg:inline font-mono text-micro uppercase tracking-wide">Search</span>
            <kbd className="hidden lg:inline font-mono text-micro bg-paper2 border border-ink rounded px-1 leading-tight">⌘K</kbd>
          </button>
          <ThemeToggle />
          {/* the bars fold into an X when open */}
          <button className="md:hidden relative z-50 w-11 h-11 -mr-2" onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          <span className={`absolute left-2.5 right-2.5 h-0.5 bg-ink transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[14px]"}`} />
          <span className={`absolute left-2.5 right-2.5 top-1/2 -translate-y-1/2 h-0.5 bg-ink transition-all duration-200 ${open ? "opacity-0 scale-x-0" : "opacity-100"}`} />
          <span className={`absolute left-2.5 right-2.5 h-0.5 bg-ink transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-[14px]"}`} />
          </button>
        </div>
      </div>

      {/* full-screen editorial takeover */}
      {open && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-30 bg-paper flex flex-col fade-in overflow-y-auto overscroll-contain">
          {/* Set as the issue's contents rather than six shouted words: each
              entry folioed, ruled off, and closed by its own arrow. Smaller type
              buys the structure that makes it read as a printed page — and the
              whole list now fits a short phone without scrolling. */}
          <nav className="flex-1 px-6 pt-4" aria-label="Main">
            <p aria-hidden="true" className="font-mono text-micro uppercase tracking-[.2em] text-ink2 mb-1">
              <span className="text-accent mr-1.5">№</span> In this issue
            </p>
            <ul className="border-t border-ink/20">
              {NAV.map(([to, label], i) => (
                <li key={to} className="border-b border-ink/20">
                  <NavLink to={to} style={{ animationDelay: `${70 + i * 45}ms` }}
                    className={({ isActive }) =>
                      `menu-rise group relative flex items-center gap-4 min-h-[3rem] transition-colors ${isActive ? "text-accentDeep" : "hover:text-accentDeep"}`}>
                    {({ isActive }) => (
                      <>
                        {/* the accent rail that marks where you already are */}
                        <span aria-hidden="true"
                          className={`absolute -left-6 top-0 bottom-0 w-1 bg-accent origin-top transition-transform duration-300 ${isActive ? "scale-y-100" : "scale-y-0"}`} />
                        <span aria-hidden="true"
                          className={`font-mono text-micro tabular-nums w-6 shrink-0 ${isActive ? "text-accent" : "text-ink2/60"}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className={`flex-1 font-display text-2xl font-semibold leading-tight tracking-tight ${isActive ? "italic" : ""}`}>
                          {label}
                        </span>
                        <span aria-hidden="true"
                          className={`font-mono text-lg leading-none shrink-0 transition-all duration-300 ${isActive ? "text-accent" : "text-ink2/40 group-hover:text-accent group-hover:translate-x-1"}`}>
                          →
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>

            <Link to="/submit" className="stamp w-full justify-center mt-5">
              Submit a tool →
            </Link>
          </nav>

          {/* the categories ride the same scrolling rail as the directory —
              wrapped, eight chips cost four rows and push the panel off a short
              phone; on one line they cost one */}
          <div className="border-t-2 border-ink px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p aria-hidden="true" className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-2.5">
              Browse by category
            </p>
            <div className="rail">
              {cats.map((c) => (
                <Link key={c.slug} to={`/category/${c.slug}`}
                  style={{ "--cat": c.colorPrimary, boxShadow: "2px 2px 0 var(--shadow-cast)" }}
                  className="group/m inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide whitespace-nowrap px-3 min-h-touch border-2 border-ink rounded-full bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:text-white hover:bg-[var(--cat)] hover:border-[var(--cat)] active:text-white active:bg-[var(--cat)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--cat)] shrink-0 transition-colors group-hover/m:bg-white" />
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// A sleek rounded newsletter capture with an accent send button, wired to the
// real subscribe endpoint.
function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // null | sending | sent | error

  const submit = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) { setStatus("error"); return; }
    setStatus("sending");
    try { await subscribe({ email }); setStatus("sent"); setEmail(""); }
    catch { setStatus("error"); }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <div className="flex items-center gap-2 border-2 border-ink rounded-full bg-paper pl-5 pr-1.5 py-1.5 transition-transform duration-200 focus-within:-translate-y-0.5"
        style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" aria-label="Email address" autoComplete="email"
          className="flex-1 min-w-0 h-11 bg-transparent outline-none text-base" />
        <button type="submit" disabled={status === "sending"} aria-label="Subscribe"
          className="group/sub grid place-items-center w-11 h-11 rounded-full bg-accent text-white shrink-0 transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-60">
          <span className="text-lg leading-none transition-transform duration-300 group-hover/sub:translate-x-0.5">→</span>
        </button>
      </div>
      <div aria-live="polite" className="h-5 mt-2 font-mono text-[11px] uppercase tracking-[.14em]">
        {status === "sent" && <span className="text-green-700">You're in — check your inbox.</span>}
        {status === "error" && <span className="text-accentDeep">Enter a valid email address.</span>}
      </div>
      <p className="font-mono text-micro uppercase tracking-[.18em] text-ink2 inline-flex items-center gap-1.5">
        <span className="text-accent">✦</span> Free · No spam · Unsubscribe anytime
      </p>
    </form>
  );
}

// A column of footer links set in the display serif, each revealing an accent
// arrow on hover.
function FooterCol({ title, links }) {
  return (
    <div>
      <h4 className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3 md:mb-4">{title}</h4>
      <ul className="space-y-0.5 md:space-y-2.5">
        {links.map(([to, label]) => (
          <li key={to}>
            {/* full 44px tap height on touch screens; back to a tight printed list on desktop */}
            <Link to={to} className="group/l inline-flex items-center gap-1.5 font-display text-lg leading-tight hover:text-accentDeep transition-colors min-h-touch md:min-h-0">
              {label}
              <span aria-hidden="true" className="text-accent opacity-0 -translate-x-1 transition-all duration-300 group-hover/l:opacity-100 group-hover/l:translate-x-0">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const [cats, setCats] = useState([]);
  useEffect(() => { getCategories().then(setCats).catch(() => {}); }, []);

  return (
    <footer className="relative border-t-2 border-ink mt-16 sm:mt-24 overflow-hidden bg-paper">
      <span aria-hidden="true" className="newsfield absolute inset-0 pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-14">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 sm:gap-12 lg:gap-20">
          {/* identity · mission · signup — one voice, the left half */}
          <div>
            <Link to="/" className="group inline-block">
              <span className="font-display text-wordmark font-semibold block">
                <span className="transition-colors duration-500 group-hover:text-transparent group-hover:[-webkit-text-stroke:1.5px_#1C1714]">Toolhaven</span>
                <span className="text-accent inline-block transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-2 group-hover:rotate-12">.</span>
              </span>
            </Link>
            <p className="font-display text-xl md:text-2xl leading-snug mt-4 mb-8 max-w-md text-pretty">
              We read the fine print, try the tools ourselves, and list the downsides — <span className="text-accentDeep">every time.</span>
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[.2em] text-accentDeep mb-3">The honest shortlist — twice a month</p>
            <Newsletter />
          </div>

          {/* the way around — navigation opposite */}
          <div className="grid grid-cols-2 gap-8">
            <FooterCol title="Browse" links={[...NAV, ["/submit", "Submit a tool"]]} />
            <div>
              <h4 className="font-mono text-[11px] uppercase tracking-[.2em] text-accentDeep mb-4">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <Link key={c.slug} to={`/category/${c.slug}`}
                    style={{ "--cat": c.colorPrimary, boxShadow: "2px 2px 0 var(--shadow-cast)" }}
                    className="group/c inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide px-3 py-1.5 min-h-touch md:min-h-0 border-2 border-ink rounded-full bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:text-white hover:bg-[var(--cat)] hover:border-[var(--cat)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--cat)] transition-colors group-hover/c:bg-white" />
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* The colophon — an inked baseline bar lifted on a risograph-offset accent
            shadow, so the legal small-print reads as a deliberate masthead footer
            instead of grey text lost in the dot field behind it. */}
        <div className="relative mt-14 bg-ink text-paper rounded-xl border-2 border-ink px-6 py-6 md:px-8"
          style={{ boxShadow: "7px 7px 0 #E8431F" }}>
          {/* a faint halftone tooth over the ink, and a stamped folio in the corner */}
          <div className="halftone absolute inset-0 rounded-xl opacity-[.07] pointer-events-none" aria-hidden="true" />
          <span aria-hidden="true"
            className="absolute -top-3 right-5 font-mono text-micro uppercase tracking-[.2em] bg-accent text-white px-2.5 py-1 border-2 border-ink rotate-3 select-none">
            Vol. {new Date().getFullYear()}
          </span>

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* legal links, separated by the house ✦ mark, each with an accent underline that wipes in */}
            <nav className="flex flex-wrap items-center font-mono text-[11px] uppercase tracking-[.18em]">
              {[["/privacy", "Privacy"], ["/disclosure", "Affiliate Disclosure"], ["/terms", "Terms"], ["/contact", "Contact"]].map(([to, label], i) => (
                <span key={to} className="inline-flex items-center">
                  {i > 0 && <span aria-hidden="true" className="text-accent px-3 select-none">✦</span>}
                  <Link to={to}
                    className="relative inline-flex items-center min-h-touch md:min-h-0 md:py-0.5 text-paper/80 hover:text-white transition-colors
                      after:absolute after:left-0 after:right-0 after:bottom-2 md:after:bottom-0 after:h-0.5 after:bg-accent
                      after:origin-left after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 after:ease-[cubic-bezier(.2,.8,.2,1)]">
                    {label}
                  </Link>
                </span>
              ))}
            </nav>

            {/* the affiliate disclosure as a pinned ticket — visible by design, which compliance likes */}
            <Link to="/disclosure"
              className="group/d self-start lg:self-auto inline-flex items-center gap-2.5 font-mono text-micro uppercase tracking-[.16em]
                text-paper/75 hover:text-white border border-paper/25 hover:border-accent rounded-full pl-2 pr-4 py-1.5 transition-colors">
              <span className="grid place-items-center w-5 h-5 rounded-full bg-accent text-white text-[11px] leading-none transition-transform duration-300 group-hover/d:rotate-12">✦</span>
              Some links are partner links — your price stays the same
            </Link>
          </div>

          {/* a hairline in paper, then the colophon line: mark, copyright, and the mission in three words */}
          <div className="relative mt-6 pt-5 border-t border-paper/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3
            font-mono text-micro uppercase tracking-[.2em] text-paper/55">
            <p className="inline-flex items-center gap-2">
              <span className="text-accent text-xs">✦</span>
              © {new Date().getFullYear()} Toolhaven — The honest tools guide
            </p>
            <p className="text-accent/90">No paid rankings. Ever.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
