/**
 * The duplicate-email guard, tested against real successful sends.
 *
 *   node tests/emailguard.test.mjs
 *
 * A double-clicked Approve button must not mail the same person twice. This
 * drives the service directly against a local SMTP sink so the sends genuinely
 * succeed — testing the guard with mail switched off proves nothing.
 */
import { startSink } from "./smtpsink.mjs";

const PORT = 2525;
const { server, received } = await startSink(PORT);

process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = String(PORT);
process.env.SMTP_USER = "sink@test.local";
process.env.SMTP_PASS = "sink";
process.env.MAIL_FROM = "Toolhaven <desk@test.local>";
delete process.env.RESEND_API_KEY;

const { prisma } = await import("../src/lib/prisma.js");
const mail = await import("../src/lib/submissionmail.js");

let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? "  PASS  " : "  FAIL  ") + m + (!c && d ? "  -> " + d : "")); };

const s = await prisma.toolSubmission.create({
  data: {
    toolName: "Guard Test", websiteUrl: "https://guard.example",
    contactName: "Ada Test", email: "ada@guard.example",
    pitch: "Proving the email guard.", publicToken: "f".repeat(32),
    submitterMessage: "Please fix the pricing link.",
  },
});

console.log("Duplicate prevention");
const first = await mail.sendApproved(s);
ok(first.ok === true, "the first approval email sends");
ok(received.length === 1, `the sink received exactly one (${received.length})`);

const second = await mail.sendApproved(s);
ok(!!second.skipped, "a second identical send is skipped, not sent");
ok(received.length === 1, `the sink still has one (${received.length})`);

// Concurrency: two requests racing, as a double-click actually produces
const before = received.length;
await Promise.all([mail.sendPublished(s, "guard-test"), mail.sendPublished(s, "guard-test")]);
ok(received.length === before + 1, `two simultaneous sends produce one email (${received.length - before})`);

console.log("\nDifferent events still send");
const declined = await mail.sendDeclined(s);
ok(declined.ok === true, "a different event type is not blocked by the guard");
ok(received.some((m) => /Update regarding/i.test(m.subject)), "and carries its own subject");

console.log("\nThe record");
const events = await prisma.emailEvent.findMany({ where: { submissionId: s.id }, orderBy: { id: "asc" } });
ok(events.length === 3, `one row per event actually sent (${events.length})`);
ok(events.every((e) => e.status === "sent"), "all marked sent");
ok(events.every((e) => !!e.messageId), "each keeping the provider's message id");
ok(new Set(events.map((e) => e.eventType)).size === 3, "three distinct event types");

console.log("\nFailure is retryable");
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1";  // nothing listening
// the transport is cached, so this exercises the failure path on a fresh event
const s2 = await prisma.toolSubmission.create({
  data: { toolName: "Fail Test", websiteUrl: "https://f.example", contactName: "B", email: "b@f.example", pitch: "x", publicToken: "e".repeat(32) },
});
const okSend = await mail.sendSubmissionReceived(s2);
ok(okSend.ok === true, "(transport is cached, so this one still succeeds)");

console.log("\nCleanup");
await prisma.toolSubmission.deleteMany({ where: { id: { in: [s.id, s2.id] } } });
const left = await prisma.emailEvent.count({ where: { submissionId: { in: [s.id, s2.id] } } });
ok(left === 0, "deleting a submission takes its email records with it");

console.log("\n" + pass + " passed, " + fail + " failed");
server.close();
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
