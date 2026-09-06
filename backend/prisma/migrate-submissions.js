// Move existing submissions onto the new review vocabulary, and give each one
// the token its status page is reached by.
//
// The old set was pending | reviewing | listed | declined, which conflated
// "we said yes" with "it is on the site". Safe to re-run: every step is
// idempotent and nothing is deleted.
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const RENAME = {
  reviewing: "under_review",
  listed: "published",
  // pending and declined keep their names
};

async function main() {
  for (const [from, to] of Object.entries(RENAME)) {
    const { count } = await prisma.toolSubmission.updateMany({
      where: { status: from }, data: { status: to },
    });
    if (count) console.log(`  ${from} → ${to}: ${count}`);
  }

  // A token per submission. 32 hex characters from a CSPRNG — this is the only
  // thing standing between a stranger and someone else's submission, so it is
  // not derived from the id or the email.
  const untokened = await prisma.toolSubmission.findMany({
    where: { publicToken: null }, select: { id: true, createdAt: true, status: true },
  });
  for (const s of untokened) {
    await prisma.toolSubmission.update({
      where: { id: s.id },
      data: {
        publicToken: randomBytes(16).toString("hex"),
        submittedAt: s.createdAt,
        lastStatusChange: s.createdAt,
      },
    });
  }
  if (untokened.length) console.log(`  tokens issued: ${untokened.length}`);

  // Seed the audit trail with what we can honestly reconstruct: that each of
  // these was created. Nothing else about their history was recorded at the
  // time, and inventing timestamps for transitions we never logged would make
  // the trail worse than empty.
  for (const s of untokened) {
    const already = await prisma.submissionEvent.count({ where: { submissionId: s.id, type: "created" } });
    if (already) continue;
    await prisma.submissionEvent.create({
      data: {
        submissionId: s.id, type: "created", toStatus: s.status,
        actor: "submitter", createdAt: s.createdAt,
        detail: "Recorded before the audit trail existed; earlier transitions were not logged.",
      },
    });
  }

  const st = await prisma.toolSubmission.groupBy({ by: ["status"], _count: true });
  console.log("\n  now: " + st.map((x) => `${x.status}=${x._count}`).join(", "));
  console.log("  with a status link: " + await prisma.toolSubmission.count({ where: { publicToken: { not: null } } }));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
