// Analytics — the integration point, not an integration.
//
// Nothing is sent anywhere until a provider is configured, and no provider is
// bundled: adding one is a script tag in index.html plus one env var, so the
// site ships no tracking weight by default and needs no cookie banner until you
// decide it does.
//
// Every call goes through track(), so the events are declared in one place
// (EVENTS below) rather than scattered as string literals across components.
// Whatever you connect later receives the same, already-named event stream.
//
// To connect a provider, set exactly one of these in the frontend .env:
//
//   VITE_ANALYTICS=plausible   + <script defer data-domain="toolhaven.net"
//                                 src="https://plausible.io/js/script.js"></script>
//   VITE_ANALYTICS=ga          + the gtag.js snippet, and VITE_GA_ID=G-XXXXXXX
//   VITE_ANALYTICS=umami       + the Umami snippet
//   VITE_ANALYTICS=debug         logs to the console — for checking wiring
//
// Leave it unset and every call below is a no-op.

const PROVIDER = import.meta.env.VITE_ANALYTICS || "";

/** The full event vocabulary. Add here, not inline at call sites. */
export const EVENTS = {
  OUTBOUND_CLICK: "outbound_click",   // someone left for a tool — the money event
  TOOL_VIEW: "tool_view",
  SEARCH: "search",
  COMPARE_VIEW: "compare_view",
  BEST_VIEW: "best_list_view",
  CATEGORY_VIEW: "category_view",
  SUBMIT_TOOL: "submit_tool",
  NEWSLETTER_SIGNUP: "newsletter_signup",
  SHARE: "share",
};

/**
 * Record an event. Never throws and never blocks — analytics failing must not
 * take a user interaction with it.
 *
 * @param {string} event  one of EVENTS
 * @param {object} props  flat, non-identifying properties
 */
export function track(event, props = {}) {
  if (!PROVIDER || typeof window === "undefined") return;

  try {
    switch (PROVIDER) {
      case "plausible":
        window.plausible?.(event, { props });
        break;

      case "ga":
        window.gtag?.("event", event, props);
        break;

      case "umami":
        window.umami?.track?.(event, props);
        break;

      case "debug":
        // eslint-disable-next-line no-console
        console.info("[analytics]", event, props);
        break;

      default:
        break;
    }
  } catch {
    // a broken tracker is not worth a broken page
  }
}

/** True when a provider is configured — for showing/hiding consent UI later. */
export const analyticsEnabled = () => Boolean(PROVIDER) && PROVIDER !== "debug";
