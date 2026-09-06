import { useState } from "react";
import { sendContact } from "../api/client.js";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

const TYPES = [
  ["general", "General question"],
  ["suggestion", "Suggest a tool"],
  ["bug", "Bug report"],
  ["partnership", "Partnership / affiliate"],
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", messageType: "general", message: "" });
  const [status, setStatus] = useState(null); // null | "sending" | "sent" | "error"
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email.includes("@") || !form.message) { setStatus("error"); return; }
    setStatus("sending");
    try { await sendContact(form); setStatus("sent"); setForm({ name: "", email: "", subject: "", messageType: "general", message: "" }); }
    catch { setStatus("error"); }
  };

  const field = "w-full border border-rule rounded-card bg-paper px-4 py-3 outline-none focus:border-accent";
  const lab = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo title="Contact" description="Questions, corrections, partnership enquiries or a tool you think we've missed — get in touch." path="/contact" />
      <PageHead kicker="Contact" title="Say hello">
        Found a bug, want a tool reviewed, or thinking partnership? Drop a line.
      </PageHead>

      <Reveal as="form" stagger className="space-y-5" onSubmit={submit} noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="c-name" className={lab}>Your name</label>
            <input id="c-name" name="name" autoComplete="name" className={field}
              placeholder="Jane Doe" value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label htmlFor="c-email" className={lab}>Email</label>
            <input id="c-email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false}
              className={field} placeholder="you@example.com" value={form.email} onChange={set("email")} />
          </div>
        </div>
        <div>
          <label htmlFor="c-type" className={lab}>What's this about?</label>
          <select id="c-type" name="messageType" className={field} value={form.messageType} onChange={set("messageType")}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-subject" className={lab}>Subject</label>
          <input id="c-subject" name="subject" autoComplete="off" className={field}
            placeholder="A short summary…" value={form.subject} onChange={set("subject")} />
        </div>
        <div>
          <label htmlFor="c-message" className={lab}>Message</label>
          <textarea id="c-message" name="message" className={`${field} min-h-[160px] resize-y`}
            placeholder="Tell us what's on your mind…" value={form.message} onChange={set("message")} />
        </div>
        <button type="submit" disabled={status === "sending"} className="stamp disabled:opacity-60">
          {status === "sending" ? "Sending…" : "Send message →"}
        </button>
      </Reveal>

      <div aria-live="polite" className="min-h-[1.5rem]">
        {status === "sent" && <p className="mt-5 font-mono text-sm text-green-700">Thanks — your message is in. We'll get back to you.</p>}
        {status === "error" && <p className="mt-5 font-mono text-sm text-accentDeep">Please fill in your name, a valid email, and a message.</p>}
      </div>
    </div>
  );
}
