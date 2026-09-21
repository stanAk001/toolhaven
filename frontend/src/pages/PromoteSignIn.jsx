/**
 * /promote/signin?token=… — where a sign-in link lands.
 *
 * The link is single-use, so this exchanges it immediately and replaces the URL
 * before anything else happens: a token sitting in the address bar ends up in
 * browser history, in a screenshot, and in the Referer header of the next
 * request the page makes.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { exchangeOwnerToken } from "../api/client.js";
import { writeSession } from "../lib/ownersession.js";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

export default function PromoteSignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setError("That link is missing its sign-in code."); return; }

    let alive = true;
    exchangeOwnerToken(token)
      .then((session) => {
        if (!alive) return;
        writeSession(session);
        // replace, so Back does not return to a spent token.
        navigate("/promote/dashboard", { replace: true });
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || "That sign-in link didn't work. Please request a new one.");
      });
    return () => { alive = false; };
  }, [params, navigate]);

  return (
    <div className="max-w-xl mx-auto px-5 sm:px-6 py-16 fade-in">
      <Seo title="Signing in" path="/promote/signin" noIndex />
      {error ? (
        <>
          <PageHead kicker="Toolhaven Promote" title="That link didn't work">
            {error}
          </PageHead>
          <Link to="/promote/dashboard" className="stamp">Request a new link</Link>
        </>
      ) : (
        <p className="text-ink2 font-mono text-sm">Signing you in…</p>
      )}
    </div>
  );
}
