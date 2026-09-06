/**
 * Adding a tool from the desk.
 *
 * The point of this form is that getting approved by an affiliate programme
 * should never require a deploy. Paste the tracking link, describe the tool,
 * save — it is live, filed under a category, with the partner record that owns
 * the link already wired to it.
 *
 * Two rules are built into the shape of it. The tracking URL is only ever
 * written to the partner, because one affiliate link in two places is one that
 * will eventually disagree with itself. And there is nowhere here to type a
 * rating, a review count or a score: a new tool arrives with no figures and
 * earns them exactly as every other tool does.
 */
import { useState } from "react";
import { Plus, X, Link2 } from "lucide-react";
import { createTool } from "../api/client.js";
import { ImageUpload } from "./imageupload.jsx";

const field = "w-full border border-rule rounded-ui bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";
const hint = "font-mono text-nano text-ink2/80 mt-1";

const PRICE_TYPES = [
  ["freemium", "Freemium — free tier plus paid plans"],
  ["free", "Free"],
  ["paid", "Paid only"],
  ["subscription", "Subscription"],
  ["custom", "Custom / talk to sales"],
];

const BLANK = {
  name: "", websiteUrl: "", description: "", fullDescription: "",
  bestFor: "", caveat: "", category: "", priceType: "freemium",
  freeTier: true, freeTrial: false, logoMono: "", logoUrl: "", logoAlt: "",
  isPartner: false, partnerName: "", affiliateNetwork: "", affiliateUrl: "",
};

const slugPreview = (s) => String(s || "").toLowerCase().trim()
  .replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function AddTool({ token, categories = [], onAdded }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(BLANK);
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const set = (k) => (e) =>
    setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setDone(null);
    try {
      const { tool } = await createTool(f, token);
      setDone(tool);
      setF(BLANK);
      setLogo(null);
      onAdded?.(tool);
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't add that one.");
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <div className="mb-5">
        <button onClick={() => { setOpen(true); setDone(null); }}
          className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide
            border border-rule rounded-ui px-4 bg-paper hover:bg-ink hover:text-paper transition-colors">
          <Plus size={14} aria-hidden="true" /> Add a tool
        </button>
        {done && (
          <p className="font-mono text-label text-green-700 mt-3">
            Added {done.name} — live at /tools/{done.slug}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="border border-rule rounded-card bg-paper shadow-press mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 sm:px-5 py-3">
        <div>
          <h3 className="font-display text-xl font-semibold leading-tight">Add a tool</h3>
          <p className="font-mono text-nano uppercase tracking-[.14em] text-ink2 mt-0.5">
            It goes live as soon as you save
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close"
          className="grid place-items-center w-10 h-10 shrink-0 rounded-ui border border-rule hover:bg-paper2 transition-colors">
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="at-name" className={label}>Name · required</label>
            <input id="at-name" className={field} value={f.name} onChange={set("name")} placeholder="Zapier" required />
            {f.name && <p className={hint}>Address: /tools/{slugPreview(f.name)}</p>}
          </div>
          <div>
            <label htmlFor="at-url" className={label}>Official website · required</label>
            <input id="at-url" className={field} value={f.websiteUrl} onChange={set("websiteUrl")}
              placeholder="https://zapier.com/" required />
            <p className={hint}>Their own site, not the tracking link</p>
          </div>
        </div>

        <div>
          <label htmlFor="at-cat" className={label}>Category · required</label>
          <select id="at-cat" className={field} value={f.category} onChange={set("category")} required>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>

        {/* The brand mark, and the two letters that stand in for it.
            Leave the image blank and the fetcher will go and read it off the
            vendor's own site after you save — that is the better route, because
            it verifies the file actually loads and stores it here rather than
            hotlinking someone else's CDN. The initials are the fallback for the
            handful of vendors that refuse automated requests. */}
        <div className="border border-rule rounded-card bg-paper2/30 p-3.5">
          <p className="font-mono text-label uppercase tracking-[.14em] text-ink2 mb-3">Logo</p>
          <div className="flex items-start gap-3.5">
            <span aria-hidden="true"
              className="grid place-items-center shrink-0 w-14 h-14 rounded-ui border border-rule overflow-hidden bg-paper">
              {f.logoUrl
                ? <img src={f.logoUrl} alt="" className="w-full h-full object-contain p-1.5"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : <span className="font-display font-bold text-lg text-ink2">
                    {(f.logoMono || f.name.slice(0, 2) || "?").toUpperCase()}
                  </span>}
            </span>

            <div className="grid sm:grid-cols-3 gap-3 flex-1 min-w-0">
              {/* Was a path-or-URL box, which meant knowing where the file
                  would end up before it existed. Upload it, drop it, or paste
                  a screenshot of the mark straight off the vendor's site. */}
              <div className="sm:col-span-3">
                <ImageUpload
                  value={logo}
                  onChange={(v) => { setLogo(v); setF((p) => ({ ...p, logoUrl: v?.url || "" })); }}
                  label="Upload the mark"
                  hint="Or leave it: run the logo fetcher afterwards and it reads it off their site."
                />
              </div>
              <div>
                <label htmlFor="at-mono" className={label}>Initials</label>
                <input id="at-mono" className={field} maxLength={3} value={f.logoMono} onChange={set("logoMono")}
                  placeholder={f.name.slice(0, 2) || "Zp"} />
                <p className={hint}>Shown until a logo exists</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="at-alt" className={label}>Image description</label>
                <input id="at-alt" className={field} value={f.logoAlt} onChange={set("logoAlt")}
                  placeholder={f.name ? `${f.name} logo` : "Zapier logo"} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="at-desc" className={label}>One line · required</label>
          <input id="at-desc" className={field} value={f.description} onChange={set("description")}
            placeholder="Connects apps to each other and runs simple workflows between them." required />
          <p className={hint}>This is all a listing card shows, so make it the sentence that decides it</p>
        </div>

        <div>
          <label htmlFor="at-full" className={label}>What it is</label>
          <textarea id="at-full" rows={4} className={field + " resize-y"} value={f.fullDescription}
            onChange={set("fullDescription")}
            placeholder="The paragraph at the top of the review. What it actually does, and where it sits against the alternatives." />
        </div>

        {/* The two halves of the trade-off. They drive the listing card as well
            as the page, and a tool with no catch on file looks like one nobody
            has properly used. */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="at-best" className={label}>Best for</label>
            <textarea id="at-best" rows={3} className={field + " resize-y"} value={f.bestFor} onChange={set("bestFor")}
              placeholder="Who this genuinely suits." />
          </div>
          <div>
            <label htmlFor="at-catch" className={label}>The catch</label>
            <textarea id="at-catch" rows={3} className={field + " resize-y"} value={f.caveat} onChange={set("caveat")}
              placeholder="What to watch out for. Every tool has one." />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 items-end">
          <div>
            <label htmlFor="at-price" className={label}>Pricing model</label>
            <select id="at-price" className={field} value={f.priceType} onChange={set("priceType")}>
              {PRICE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <p className={hint}>Actual prices are read from their pricing page — leave that to the crawler</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 pb-2.5">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={f.freeTier} onChange={set("freeTier")} className="w-4 h-4 accent-current" />
              Has a free tier
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={f.freeTrial} onChange={set("freeTrial")} className="w-4 h-4 accent-current" />
              Has a free trial
            </label>
          </div>
        </div>

        {/* The affiliate half. Folded away until it applies, so adding a tool
            you earn nothing from is not a form full of empty commercial fields. */}
        <div className="border border-rule rounded-card bg-paper2/30 p-3.5">
          <label className="inline-flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={f.isPartner} onChange={set("isPartner")} className="w-4 h-4 accent-current" />
            <span className="font-mono text-label uppercase tracking-[.14em]">
              <Link2 size={13} className="inline mr-1.5 -mt-0.5" aria-hidden="true" />
              I have an affiliate link for this
            </span>
          </label>

          {f.isPartner && (
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <div className="sm:col-span-3">
                <label htmlFor="at-aff" className={label}>Tracking link · required</label>
                <input id="at-aff" className={field} value={f.affiliateUrl} onChange={set("affiliateUrl")}
                  placeholder="https://try.zapier.com/…" />
                <p className={hint}>
                  Stored once, on the partner record. Outbound clicks are sent here; everything else on the site keeps
                  pointing at their own site.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="at-pname" className={label}>Partner name</label>
                <input id="at-pname" className={field} value={f.partnerName} onChange={set("partnerName")}
                  placeholder={f.name || "Zapier"} />
              </div>
              <div>
                <label htmlFor="at-net" className={label}>Network</label>
                <input id="at-net" className={field} value={f.affiliateNetwork} onChange={set("affiliateNetwork")}
                  placeholder="Direct, Impact, Cello…" />
              </div>
            </div>
          )}
        </div>

        {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="submit" disabled={busy} className="stamp text-xs disabled:opacity-60">
            {busy ? "Adding…" : "Add it to the index"}
          </button>
          <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
            No rating or score is set — it earns those like everything else
          </p>
        </div>
      </div>
    </form>
  );
}
