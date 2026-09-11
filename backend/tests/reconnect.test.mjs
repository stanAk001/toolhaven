/**
 * Does the retry actually recover a dead pool?
 *
 * Not a simulation. This opens a real pool, then asks Postgres to terminate its
 * backend processes — the same thing Render's proxy does to an idle socket, and
 * the same thing a laptop waking from sleep leaves behind. Then it runs a query
 * and sees whether it comes back.
 *
 * It must only ever terminate its OWN connections. The database is shared with
 * the production API, and the first version of this test terminated every
 * connection belonging to the app's database user — production's included.
 * The retry logic recovered them, but a test has no business touching
 * production at all. So the client under test is tagged with an
 * application_name, the kill is scoped to that tag, and if the tag cannot be
 * seen the test stops rather than falling back to anything broader.
 */
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

// Node does not read .env on its own; Prisma does, but only inside the client.
// The URL is needed here, before the client exists, to tag it.
process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
const ORIGINAL = process.env.DATABASE_URL;
if (!ORIGINAL) { console.log("DATABASE_URL is not set"); process.exit(1); }

const TAG = `toolhaven-reconnect-test-${process.pid}`;
const tagged = new URL(ORIGINAL);
tagged.searchParams.set("application_name", TAG);
process.env.DATABASE_URL = tagged.toString();

// Imported only now, so the shared client is built from the tagged URL.
const { prisma, isTransient } = await import("../src/lib/prisma.js");

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log("  ok   " + what); } else { fail++; console.log("  FAIL " + what); } };

// --- the classifier, including the shape the terminal actually printed ------
console.log("\n1. recognising the failure");
ok(isTransient({ code: "P1001" }), "P1001");
ok(isTransient({ name: "PrismaClientInitializationError" }), "an initialisation error");
ok(isTransient({ message: "An existing connection was forcibly closed by the remote host." }),
  "the Windows 10054 wording from your terminal");
ok(isTransient({ message: "Error in PostgreSQL connection: ConnectionReset" }), "a connection reset");
ok(!isTransient({ code: "P2003", message: "Foreign key constraint violated" }),
  "a foreign key violation is NOT retried — a real bug must still surface");
ok(!isTransient({ code: "P2002" }), "nor a unique constraint");

// A separate, untagged client, so it survives to do the killing and is never
// itself a target.
const killer = new PrismaClient({ datasources: { db: { url: ORIGINAL } } });

try {
  // --- the real thing ------------------------------------------------------
  console.log("\n2. warming a pool");
  const before = await prisma.$queryRawUnsafe("SELECT 1 AS ok");
  ok(before[0].ok === 1, "pool is live");

  const mine = await killer.$queryRawUnsafe(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND application_name = $1", TAG);
  const others = await killer.$queryRawUnsafe(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND application_name <> $1 AND pid <> pg_backend_pid()", TAG);
  ok(mine[0].n >= 1, `this test's connections are identifiable by tag (${mine[0].n} tagged, ${others[0].n} others left alone)`);
  if (mine[0].n < 1) throw new Error("tag not visible in pg_stat_activity — refusing to kill anything");

  console.log("\n3. killing this test's own connections, from the server side");
  const killed = await killer.$queryRawUnsafe(`
    SELECT count(*)::int AS n FROM (
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = current_database() AND application_name = $1
    ) t`, TAG);
  ok(killed[0].n === mine[0].n, `terminated exactly the ${killed[0].n} tagged connection(s), nothing else`);

  console.log("\n4. querying through the dead pool");
  const t = Date.now();
  let recovered = false, err = null;
  try {
    const r = await prisma.$queryRawUnsafe("SELECT 42 AS answer");
    recovered = r[0].answer === 42;
  } catch (e) { err = e; }
  const took = Date.now() - t;
  ok(recovered, recovered
    ? `recovered in ${took}ms — the pool was dropped and rebuilt`
    : `did NOT recover after ${took}ms: ${err && String(err.message).split("\n").filter(Boolean)[0]}`);

  console.log("\n5. and it still works afterwards");
  const after = await prisma.$queryRawUnsafe("SELECT 7 AS n");
  ok(after[0].n === 7, "subsequent queries are fine");
} finally {
  await killer.$disconnect();
  await prisma.$disconnect();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
