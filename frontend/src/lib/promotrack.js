/**
 * Counting what was actually seen.
 *
 * An impression is recorded when a promotional card has genuinely been on
 * screen, not when the server sent it. A card rendered below the fold that
 * nobody scrolled to was not seen, and counting it would inflate every report
 * a vendor is shown — which is the one thing that would make the analytics
 * worthless.
 *
 * Events are batched and flushed on a short timer, on tab-hide and on unload.
 * Nothing here blocks a render, and a failed flush is dropped rather than
 * retried forever: a lost impression is a rounding error, but a page that
 * stutters because of analytics is a real cost to a real reader.
 */
import { sendPromotionEvents } from "../api/client.js";

const QUEUE = [];
let timer = null;

/** One impression per campaign per placement per page view. */
const seen = new Set();

function flush() {
  timer = null;
  if (!QUEUE.length) return;
  const batch = QUEUE.splice(0, 20);
  sendPromotionEvents(batch).catch(() => { /* analytics must never surface to a reader */ });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 1200);
}

/** Queue an event. `campaign` is the campaign slug. */
export function track(campaign, type, placement) {
  if (!campaign || !type) return;
  QUEUE.push({ campaign, type, placement: placement || null });
  schedule();
}

/** Queue an impression, at most once per campaign/placement per page view. */
export function trackImpression(campaign, placement) {
  const key = `${campaign}|${placement || ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  track(campaign, "impression", placement);
}

if (typeof document !== "undefined") {
  // Leaving the tab is the last reliable moment to send. visibilitychange is
  // the one event mobile browsers can be relied on to fire; unload is not.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

/**
 * Watch an element and record an impression once it has actually been seen.
 *
 * Half the card, for a moment, is the bar — the same rough standard ad
 * measurement uses, and enough to exclude a card that flashed past during a
 * fast scroll.
 *
 * @returns {(node: Element|null) => void} a ref callback
 */
export function impressionRef(campaign, placement) {
  let observer = null;
  let timerId = null;

  return (node) => {
    if (!node) {
      observer?.disconnect();
      if (timerId) clearTimeout(timerId);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      // No observer available: count it on render rather than not at all.
      trackImpression(campaign, placement);
      return;
    }
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!timerId) {
            timerId = setTimeout(() => {
              trackImpression(campaign, placement);
              observer?.disconnect();
            }, 500);
          }
        } else if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
      }
    }, { threshold: 0.5 });
    observer.observe(node);
  };
}

/** The outbound hop for a promoted card. */
export const promoteHref = (campaign, placement) => {
  const base = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/+$/, "");
  return `${base}/promote/go/${encodeURIComponent(campaign)}${placement ? `?p=${encodeURIComponent(placement)}` : ""}`;
};
