import { useState } from "react";
import { Link } from "react-router-dom";
import { ScanSearch, Users, ShieldCheck, Send } from "lucide-react";
import { submitTool } from "../api/client.js";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

const CATEGORIES = ["AI Tools", "Stock Trading", "Productivity", "Design", "Development", "Marketing", "Video & Audio", "Customer Support", "Other / not sure"];
const PRICING = ["Free", "Freemium", "Paid", "Subscription"];
const PROGRAMS = ["PartnerStack", "Impact", "ShareASale", "Other network", "None yet"];

const EMPTY = {
  toolName: "", websiteUrl: "", category: "", pricing: "", affiliateProgram: "",
  contactName: "", email: "", pitch: "", details: "", website: "", // `website` is the honeypot
  // Optional detail. Everything here is something a reviewer would otherwise
  // have to go and find, which is the difference between a queue that can be
  // worked and a queue of links needing research.
  description: "", logoUrl: "", features: "", useCases: "", targetAudience: "",
  companyName: "", socialLinks: "", screenshots: "",
};

function Promise({ icon: Icon, title, text }) {
  return (
    <div className="tactile rounded-card border-2 border-ink bg-paper p-5">
      <span className="grid place-items-center w-11 h-11 rounded-card bg-ink text-paper mb-3">
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <h3 className="font-display text-lg font-semibold leading-tight mb-1">{title}</h3>
      <p className="text-sm text-ink2 leading-snug">{text}</p>
    </div>
  );
}

export default function Submit() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState(null); // null | sending | sent | error
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.toolName || !form.websiteUrl || !form.contactName || !form.email.includes("@") || !form.pitch) {
      setError("Please fill in the tool name, website, your name, a valid email, and the one-line pitch.");
      setStatus("error");
      return;
    }
    setStatus("sending"); setError("");
    try { await submitTool(form); setStatus("sent"); }
    catch (err) {
      setError(err?.response?.data?.error || "Something went wrong sending that. Please try again.");
      setStatus("error");
    }
  };

  const field = "w-full border-2 border-ink rounded-card bg-paper px-4 py-3 outline-none focus:border-accent transition-colors";
  const lab = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

  if (status === "sent") {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-14 sm:py-20 fade-in text-center">
        <div className="relative inline-grid place-items-center w-20 h-20 rounded-card bg-ink text-paper mb-7" style={{ boxShadow: "6px 6px 0 var(--shadow-cast)" }}>
          <span className="font-display text-3xl">✦</span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4 leading-tight">Submission received.</h1>
        <p className="text-lg text-ink2 max-w-md mx-auto mb-8">
          Thanks — <strong className="text-ink">{form.toolName}</strong> is in the queue. We read every submission and try the promising ones properly. If it's a fit, we'll be in touch at <strong className="text-ink">{form.email}</strong>. No spam, no chase emails.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/tools" className="stamp">Browse the directory →</Link>
          <button onClick={() => { setForm(EMPTY); setStatus(null); }} className="stamp-paper">Submit another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo title="Submit your tool" description="Get your software in front of people actively looking for tools. Every submission is reviewed before publication." path="/submit" />
      <PageHead kicker="For founders & makers" title="Put your tool in front of buyers who trust us.">
        We review tools independently and link to the good ones through affiliate partnerships. If yours is genuinely worth it, this is how the right people find it.
      </PageHead>

      {/* three honest promises — the reason a listing here actually carries weight */}
      <Reveal stagger className="grid sm:grid-cols-3 gap-4 mb-12">
        <Promise icon={ScanSearch} title="An honest review" text="We try it properly and write the real verdict — the strengths and the catch. No press-release fluff." />
        <Promise icon={Users} title="A buying audience" text="Our readers arrive ready to choose a tool, not just to browse. That's who'll see you." />
        <Promise icon={ShieldCheck} title="No pay-to-play" text="You can't buy a score or a ranking here. That's exactly why a good review carries weight." />
      </Reveal>

      <div className="rounded-card border-2 border-ink bg-paper p-6 md:p-8" style={{ boxShadow: "8px 8px 0 var(--shadow-cast)" }}>
        <h2 className="font-display text-2xl font-semibold mb-1">Tell us about your tool</h2>
        <p className="text-ink2 mb-6">Five minutes. The more honest the pitch, the better your odds.</p>

        <Reveal as="form" stagger className="space-y-5" onSubmit={submit} noValidate>
          {/* honeypot — hidden from humans, catches bots */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")}
            className="hidden" aria-hidden="true" />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="s-tool" className={lab}>Tool name *</label>
              <input id="s-tool" className={field} placeholder="e.g. Acme Analytics" value={form.toolName} onChange={set("toolName")} />
            </div>
            <div>
              <label htmlFor="s-url" className={lab}>Website URL *</label>
              <input id="s-url" type="url" inputMode="url" spellCheck={false} className={field} placeholder="https://…" value={form.websiteUrl} onChange={set("websiteUrl")} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="s-cat" className={lab}>Category</label>
              <select id="s-cat" className={field} value={form.category} onChange={set("category")}>
                <option value="">Choose…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="s-price" className={lab}>Pricing</label>
              <select id="s-price" className={field} value={form.pricing} onChange={set("pricing")}>
                <option value="">Choose…</option>
                {PRICING.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="s-prog" className={lab}>Affiliate program</label>
              <select id="s-prog" className={field} value={form.affiliateProgram} onChange={set("affiliateProgram")}>
                <option value="">Choose…</option>
                {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="s-pitch" className={lab}>One-line pitch *</label>
            <input id="s-pitch" className={field} maxLength={140} placeholder="What does it do, in one honest sentence?" value={form.pitch} onChange={set("pitch")} />
          </div>

          <div>
            <label htmlFor="s-details" className={lab}>Anything else we should know?</label>
            <textarea id="s-details" className={`${field} min-h-[120px] resize-y`} placeholder="Who it's really for, what makes it different, the honest downside, a demo login if you have one…" value={form.details} onChange={set("details")} />
          </div>

          {/* Everything past this point is optional, and said so plainly — a
              wall of required fields is how a submission form stops collecting
              submissions. Filling it in is framed as what it is: the difference
              between waiting for a reviewer to research you and being ready to
              publish. */}
          <details className="border-2 border-ink rounded-card bg-paper2/40 overflow-hidden group/d">
            <summary className="flex items-center justify-between gap-3 px-4 min-h-touch cursor-pointer select-none list-none">
              <span className="font-mono text-label uppercase tracking-[.14em]">
                Add detail <span className="text-ink2">— optional, speeds up review</span>
              </span>
              <span aria-hidden="true" className="text-accent transition-transform duration-300 group-open/d:rotate-45">+</span>
            </summary>

            <div className="px-4 pb-4 pt-1 space-y-4 border-t-2 border-ink/15">
              <p className="text-sm text-ink2 text-pretty">
                The more of this we have, the less we have to go and find — and the sooner your page can go live.
              </p>

              <div>
                <label htmlFor="s-desc" className={lab}>Short description</label>
                <input id="s-desc" className={field} maxLength={400}
                  placeholder="A sentence or two, the way you'd describe it to a colleague"
                  value={form.description} onChange={set("description")} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="s-company" className={lab}>Company / maker</label>
                  <input id="s-company" className={field} value={form.companyName} onChange={set("companyName")} />
                </div>
                <div>
                  <label htmlFor="s-logo" className={lab}>Logo URL</label>
                  <input id="s-logo" className={field} placeholder="https://…" value={form.logoUrl} onChange={set("logoUrl")} />
                </div>
              </div>

              <div>
                <label htmlFor="s-audience" className={lab}>Who is it for?</label>
                <input id="s-audience" className={field} maxLength={300}
                  placeholder="Solo founders, design teams, accountants…"
                  value={form.targetAudience} onChange={set("targetAudience")} />
              </div>

              <div>
                <label htmlFor="s-features" className={lab}>Key features — one per line</label>
                <textarea id="s-features" rows={4} className={`${field} resize-y`}
                  placeholder={"Real-time collaboration\nOffline mode\nAPI access"}
                  value={form.features} onChange={set("features")} />
              </div>

              <div>
                <label htmlFor="s-usecases" className={lab}>What people use it for — one per line</label>
                <textarea id="s-usecases" rows={3} className={`${field} resize-y`}
                  placeholder={"Writing product specs\nRunning a weekly review"}
                  value={form.useCases} onChange={set("useCases")} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="s-social" className={lab}>Social links — one per line</label>
                  <textarea id="s-social" rows={3} className={`${field} resize-y`}
                    placeholder={"https://x.com/…\nhttps://linkedin.com/company/…"}
                    value={form.socialLinks} onChange={set("socialLinks")} />
                </div>
                <div>
                  <label htmlFor="s-shots" className={lab}>Screenshot URLs — one per line</label>
                  <textarea id="s-shots" rows={3} className={`${field} resize-y`}
                    placeholder={"https://…/screen-1.png"}
                    value={form.screenshots} onChange={set("screenshots")} />
                </div>
              </div>
            </div>
          </details>

          <div className="rule my-2" />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="s-name" className={lab}>Your name *</label>
              <input id="s-name" autoComplete="name" className={field} placeholder="Jane Doe" value={form.contactName} onChange={set("contactName")} />
            </div>
            <div>
              <label htmlFor="s-email" className={lab}>Work email *</label>
              <input id="s-email" type="email" inputMode="email" spellCheck={false} autoComplete="email" className={field} placeholder="you@company.com" value={form.email} onChange={set("email")} />
            </div>
          </div>

          <button type="submit" disabled={status === "sending"} className="stamp disabled:opacity-60">
            {status === "sending" ? "Sending…" : <>Submit for review <Send size={16} aria-hidden="true" /></>}
          </button>

          <div aria-live="polite" className="min-h-[1.25rem]">
            {status === "error" && <p className="font-mono text-sm text-accentDeep">{error}</p>}
          </div>
        </Reveal>
      </div>

      <p className="text-center text-sm text-ink2 mt-6">
        Submitting doesn't guarantee a listing, and never buys a better one — see our <Link to="/disclosure" className="underline text-accentDeep">disclosure</Link>.
      </p>
    </div>
  );
}
