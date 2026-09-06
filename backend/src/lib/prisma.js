import { PrismaClient } from "@prisma/client";

// The database is remote (Render, Ohio) and the round trip is long enough that a
// pooled connection sometimes goes away between requests — an idle socket the
// load balancer has quietly closed, or every socket at once after the machine
// has been asleep. Prisma only discovers this when it tries to use one, and
// reports P1001 "Can't reach database server", which the route turns into a 500
// and the page turns into an empty section.
//
// Retrying used to mean running the same query again immediately. That cannot
// work: the pool hands back the same dead socket, so all three attempts failed
// inside a second and the request died anyway —
//
//     [db] P1001 on Tool.findMany — retry 1/2
//     [db] P1001 on Tool.findMany — retry 2/2
//     Error in PostgreSQL connection: ConnectionReset (10054)
//
// A stale socket is only fixed by throwing the pool away, so that is what
// happens now: on a connection-shaped failure the client disconnects, which
// closes every socket it holds, and the retry opens fresh ones.
const TRANSIENT_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1008", // operation timed out
  "P1017", // server has closed the connection
  "P2024", // timed out fetching a connection from the pool
]);

// A connection failure arrives in one of two shapes depending on when it
// happens, and they do not look alike:
//
//   mid-session  PrismaClientKnownRequestError, code "P1001"
//   at connect   PrismaClientInitializationError, code undefined, errorCode
//                undefined — the reason is only in the message
//
// Matching on `err.code` alone therefore catches the first and silently misses
// the second, which is the one that fires when the pool has to open a fresh
// connection. Check the class and the message too.
export function isTransient(err) {
  if (!err) return false;
  if (TRANSIENT_CODES.has(err.code) || TRANSIENT_CODES.has(err.errorCode)) return true;
  if ((err.name || err.constructor?.name) === "PrismaClientInitializationError") return true;
  // Prisma reports the underlying socket error in several wordings, and they
  // are not consistently spaced: "connection reset" from the driver,
  // "ConnectionReset" from the Rust layer, and the Windows text for error 10054.
  return /can't reach database server|connection ?reset|connection pool|closed the connection|forcibly closed|terminating connection/i
    .test(String(err.message || ""));
}

const ATTEMPTS = 3;
// Opening a fresh TLS connection to Ohio takes the better part of a second, and
// when Render has just dropped the socket it may need a moment more. The old
// 200/400ms gave up before a new connection could plausibly exist.
const BACKOFF_MS = [600, 1800];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createClient() {
  const base = new PrismaClient({ log: ["warn", "error"] });

  // Throwing the pool away is shared work. Twenty requests failing at the same
  // instant — which is exactly what happens when the machine wakes up — must
  // not each tear down the pool the others are trying to rebuild, so they all
  // await the same recycle. It is also rate-limited: a database that is
  // genuinely down should not have its pool churned once per query.
  let recycling = null;
  let lastRecycle = 0;
  const RECYCLE_EVERY_MS = 4000;

  const recycle = () => {
    const now = Date.now();
    if (recycling) return recycling;
    if (now - lastRecycle < RECYCLE_EVERY_MS) return Promise.resolve();
    lastRecycle = now;
    recycling = base.$disconnect()
      .catch(() => { /* already gone is the outcome we wanted */ })
      .finally(() => { recycling = null; });
    return recycling;
  };

  return base.$extends({
    query: {
      async $allOperations({ args, query, model, operation }) {
        let lastError;
        for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (!isTransient(err) || attempt === ATTEMPTS) throw err;
            lastError = err;
            // eslint-disable-next-line no-console
            console.warn(
              `[db] ${err.code || err.name} on ${model ?? "raw"}.${operation}`
              + ` — dropping the connection pool and retrying (${attempt}/${ATTEMPTS - 1})`,
            );
            await recycle();
            await sleep(BACKOFF_MS[attempt - 1] ?? 1800);
          }
        }
        throw lastError;
      },
    },
  });
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Open the pool at boot instead of on the first visitor's request, so nobody
// pays the cold TCP+TLS+auth cost just for loading the home page. A failure here
// is not fatal — the retry wrapper above will handle it when a request arrives.
export async function warmUp() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // eslint-disable-next-line no-console
    console.log("Database connection established");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[db] warm-up failed (${err.code || err.name}) — will retry on demand`);
  }
}
