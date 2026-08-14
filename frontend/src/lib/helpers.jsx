import { useEffect, useState } from "react";
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

// tiny fetch hook so pages don't each rewrite loading/error state
export function useData(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    Promise.resolve(fn())
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error };
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

export const priceLabel = (t) =>
  t.priceType === "free" ? "Free"
  : t.priceMin === 0 ? `Free · up to $${t.priceMax}/mo`
  : `$${t.priceMin}–$${t.priceMax}/mo`;
