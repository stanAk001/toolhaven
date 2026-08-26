import { useEffect, useState, useMemo } from "react";
import { keyFor, peek, isFresh, load } from "./datacache.js";
import {
  Sparkles, TrendingUp, Zap, Palette, Code2, Megaphone, Video, Headphones, Wrench,
} from "lucide-react";
import { logClick } from "../api/client.js";
import { track, EVENTS } from "./analytics.js";

// maps Category.iconKey (from the DB) to a lucide icon component
export const ICONS = {
  Sparkles, TrendingUp, Zap, Palette, Code2, Megaphone, Video, Headphones,
};
export const iconFor = (key) => ICONS[key] || Wrench;

// fallback color if a category record is missing
export const FALLBACK = { colorPrimary: "#7C3AED", colorAccent: "#00F5FF" };

// Fetch hook with a memory. Pages that have been seen once render from cache
// on the frame they mount and revalidate quietly behind the reader, so moving
// back and forth through the site costs nothing and shows no spinner. A page
// this browser has never seen still loads exactly as before.
export function useData(fn, deps = []) {
  const key = useMemo(() => keyFor(fn, deps), deps);
  const [state, setState] = useState(() => {
    const hit = peek(key);
    return { data: hit !== undefined ? hit : null, loading: hit === undefined, error: null };
  });

  useEffect(() => {
    let alive = true;
    const hit = peek(key);

    // Show what we already have immediately; only an unseen key gets a spinner.
    setState({ data: hit !== undefined ? hit : null, loading: hit === undefined, error: null });
    if (hit !== undefined && isFresh(key)) return undefined;

    load(key, fn)
      .then((d) => { if (alive) setState({ data: d, loading: false, error: null }); })
      .catch((e) => {
        // Keep showing cached data if we have it. A failed refresh is not a
        // reason to replace a working page with an error.
        if (alive) setState((s) => ({ data: s.data, loading: false, error: s.data ? null : e }));
      });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

// Logs the click server-side, mirrors it to analytics, then opens the link.
//
// Two records on purpose: the database row is the one that survives ad-blockers
// and is what an affiliate network will ask you to evidence; the analytics event
// is what lets you see it beside the rest of the funnel. If either fails the
// user still leaves for the tool — the navigation is the point.
export async function goAffiliate(tool, referrerPage) {
  track(EVENTS.OUTBOUND_CLICK, {
    tool: tool.slug,
    category: tool.category?.slug,
    from: referrerPage,
    monetised: Boolean(tool.affiliateLink),
  });

  try {
    const { redirect } = await logClick(tool.id, referrerPage);
    const url = redirect || tool.affiliateLink || tool.websiteUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    const url = tool.affiliateLink || tool.websiteUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }
}

// A price we haven't confirmed says so, rather than rendering "Free · up to
// $0/mo" — which is what a 0/0 range used to produce, and is a false claim
// about someone else's product. Vendors move pricing constantly; an unverified
// figure is worse than no figure.
// The same fact, short enough for a card footer. The long form truncated to
// "Free · up to $20/…" at three-up, which loses the only number on the line —
// worse than the wrapping it was meant to fix.
export const priceLabelShort = (t) => {
  if (t.priceType === "free") return "Free";
  const min = Number(t.priceMin) || 0;
  const max = Number(t.priceMax) || 0;
  if (max === 0) return "See pricing";
  if (min === 0) return "Free–$" + max + "/mo";
  return "$" + min + "–$" + max + "/mo";
};

export const priceLabel = (t) => {
  if (t.priceType === "free") return "Free";
  const min = Number(t.priceMin) || 0;
  const max = Number(t.priceMax) || 0;
  if (max === 0) return "See pricing";
  if (min === 0) return `Free · up to $${max}/mo`;
  return `$${min}–$${max}/mo`;
};
