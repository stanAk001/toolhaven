/**
 * Prefetch on intent.
 *
 * A reader tells you where they are going before they get there: the pointer
 * lands on a card roughly 200-300ms before the click, a finger touches before
 * it lifts, and a keyboard focus precedes Enter. That gap is usually longer
 * than the request it hides, so fetching on hover turns a visible wait into no
 * wait at all — the page is already in memory when the click arrives.
 *
 * Costs nothing when the guess is wrong: the result lands in the same cache the
 * page would have filled anyway, and a failed prefetch is swallowed rather than
 * shown. Guarded so a reader sweeping the pointer across a grid of forty cards
 * does not fire forty requests.
 */
import { useRef, useCallback } from "react";
import { prefetch } from "./datacache.js";

// A pointer crossing a card on its way somewhere else rests for a few frames at
// most; a reader who means it stays put. This waits long enough to tell them
// apart, and still leaves most of the click gap to work with.
const INTENT_MS = 90;

export function useIntentPrefetch(fn, deps = []) {
  const timer = useRef(null);
  const done = useRef(false);

  const start = useCallback(() => {
    if (done.current || timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      done.current = true;      // once per element per mount; the cache handles the rest
      prefetch(fn, deps);
    }, INTENT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const stop = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  // Touch has no hover, so the touch itself is the signal — it still lands
  // ahead of the click by the length of the tap.
  const immediate = useCallback(() => {
    stop();
    if (done.current) return;
    done.current = true;
    prefetch(fn, deps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    onMouseEnter: start,
    onMouseLeave: stop,
    onFocus: immediate,
    onTouchStart: immediate,
  };
}
