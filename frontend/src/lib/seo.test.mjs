/**
 * The origin every canonical is built from.
 *
 * The live site was serving www.toolhaven.net while VITE_SITE_URL said
 * toolhaven.net, so every page's canonical pointed at the apex — which
 * 308-redirects back to www. Search Console read that as "this page is an
 * alternate of somewhere else" and stopped indexing.
 *
 * These pin the rule: a www-only difference resolves to whatever host is
 * actually serving the page; a genuinely different origin still wins, because
 * that is what the setting exists for.
 */
import { resolveOrigin } from "./origin.js";

let pass = 0, fail = 0;
const is = (got, want, what) => {
  if (got === want) pass++;
  else { fail++; console.log(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

// The exact production mismatch, in both directions.
is(resolveOrigin("https://toolhaven.net", "https://www.toolhaven.net"),
  "https://www.toolhaven.net", "apex configured, www served — the served host wins");
is(resolveOrigin("https://www.toolhaven.net", "https://toolhaven.net"),
  "https://toolhaven.net", "www configured, apex served — still the served host");
is(resolveOrigin("https://toolhaven.net/", "https://www.toolhaven.net"),
  "https://www.toolhaven.net", "a trailing slash does not defeat the comparison");

// Agreement changes nothing.
is(resolveOrigin("https://www.toolhaven.net", "https://www.toolhaven.net"),
  "https://www.toolhaven.net", "already agreeing");

// A genuinely different origin is what the variable is for: a preview build
// must still declare the production canonical.
is(resolveOrigin("https://www.toolhaven.net", "https://toolhaven-git-main.vercel.app"),
  "https://www.toolhaven.net", "a Vercel preview keeps the configured production origin");
is(resolveOrigin("https://www.toolhaven.net", "http://localhost:5173"),
  "https://www.toolhaven.net", "local development keeps it too");

// Missing values.
is(resolveOrigin("", "https://www.toolhaven.net"), "https://www.toolhaven.net", "nothing configured");
is(resolveOrigin("https://www.toolhaven.net", ""), "https://www.toolhaven.net", "nothing served (no window)");
is(resolveOrigin("", ""), "", "neither");

// Scheme differences are not a www difference and must not be smoothed over.
is(resolveOrigin("https://www.toolhaven.net", "http://www.toolhaven.net"),
  "http://www.toolhaven.net", "same host over http — the served origin is still the honest one");

// A different site that merely starts with the same letters must not match.
is(resolveOrigin("https://toolhaven.net", "https://toolhaven.net.evil.example"),
  "https://toolhaven.net", "a lookalike host does not hijack the canonical");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
