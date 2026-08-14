// Share — the loop in one component.
//
// A developer sharing their own Toolhaven profile is the cheapest audience this
// site will ever get, so sharing has to be one tap and the result has to look
// deliberate when it lands. On a phone this hands off to the OS share sheet
// (which reaches WhatsApp, the one that matters most outside the US); on desktop
// it falls back to named targets and a copy button.
//
// The preview those links produce comes from the Open Graph tags the page's
// <Seo> already sets — there is nothing to configure here.
import { useState } from "react";
import { Link2, Check, Share2 } from "lucide-react";
import { track, EVENTS } from "../lib/analytics.js";

const btn =
  "inline-flex items-center justify-center gap-2 min-h-touch px-3.5 rounded-full border-2 border-ink " +
  "font-mono text-[11px] uppercase tracking-wide bg-paper hover:bg-paper2 transition-colors";

/**
 * @param {string} title  what the share text should say
 * @param {string} url    absolute URL; defaults to the current page
 * @param {string} context  where the share happened, for analytics
 */
export function ShareBar({ title, url, context = "page", className = "" }) {
  const [copied, setCopied] = useState(false);
  const href = url || (typeof window !== "undefined" ? window.location.href : "");
  const text = title || "Worth a look on Toolhaven";

  const enc = encodeURIComponent;
  const targets = [
    { name: "X", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(href)}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(href)}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(`${text} ${href}`)}` },
  ];

  const nativeShare = async () => {
    track(EVENTS.SHARE, { via: "native", context });
    try { await navigator.share({ title: text, url: href }); } catch { /* dismissed */ }
  };

  const copy = async () => {
    track(EVENTS.SHARE, { via: "copy", context });
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const hasNative = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-mono text-micro uppercase tracking-[.16em] text-ink2 mr-1">Share</span>

      {/* the OS sheet reaches apps a link list can't, so prefer it where it exists */}
      {hasNative && (
        <button type="button" onClick={nativeShare} className={btn}>
          <Share2 size={13} strokeWidth={2.5} aria-hidden="true" /> Share
        </button>
      )}

      {targets.map((t) => (
        <a key={t.name} href={t.href} target="_blank" rel="noopener noreferrer"
          onClick={() => track(EVENTS.SHARE, { via: t.name.toLowerCase(), context })}
          className={`${btn} ${hasNative ? "hidden sm:inline-flex" : ""}`}>
          {t.name}
        </a>
      ))}

      <button type="button" onClick={copy} className={btn}
        aria-label={copied ? "Link copied" : "Copy link"}>
        {copied
          ? <><Check size={13} strokeWidth={3} aria-hidden="true" /> Copied</>
          : <><Link2 size={13} strokeWidth={2.5} aria-hidden="true" /> Copy link</>}
      </button>
    </div>
  );
}
