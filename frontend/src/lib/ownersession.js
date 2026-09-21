/**
 * The tool owner's session, held in the browser.
 *
 * Deliberately the same shape as the admin token: a value in localStorage,
 * sent as a header. One idea of authentication in the client rather than two.
 *
 * Every accessor is wrapped, because localStorage throws outright in a private
 * window on some browsers and in embedded webviews — and being unable to read
 * a token is a reason to show the sign-in form, never a reason to show a blank
 * page.
 */
const KEY = "toolhaven-owner";

export function readSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token) return null;
    // An expired session is treated as no session; the server would refuse it
    // anyway, and asking first saves the reader a failed request.
    if (s.expiresAt && new Date(s.expiresAt) <= new Date()) return null;
    return s;
  } catch { return null; }
}

export function writeSession(session) {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* ignore */ }
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
