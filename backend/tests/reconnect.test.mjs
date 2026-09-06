/**
 * Does the retry actually recover a dead pool?
 *
 * Not a simulation. This opens a real pool, then asks Postgres to terminate its
 * own backend processes — the same thing Render's proxy does to an idle socket,
 * and the same thing a laptop waking from sleep leaves behind. Then it runs a
 * query and sees whether it comes back.
 *
 * Run against the old code this fails: three attempts on the same dead socket,
 * all inside a second. It is the only honest way to test the fix.
 */
import { PrismaClient } from "@prisma/client";
import { prisma, isTransient } from "../src/lib/prisma.js";

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

// --- the real thing --------------------------------------------------------
console.log("\n2. warming a pool");
const before = await prisma.$queryRawUnsafe("SELECT 1 AS ok");
ok(before[0].ok === 1, "pool is live");

console.log("\n3. killing every connection this client holds, from the server side");
// A separate client, so it survives to do the killing.
const killer = new PrismaClient();
const me = await killer.$queryRawUnsafe(
  "SELECT pid, application_name FROM pg_stat_activity WHERE datname = current_database()");
console.log("  " + me.length + " backends on this database before");

const killed = await killer.$queryRawUnsafe(`
  SELECT count(*)::int AS n FROM (
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()
  ) t`);
console.log("  terminated " + killed[0].n + " backend(s) — every pooled socket is now dead");

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

await killer.$disconnect();
await prisma.$disconnect();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
