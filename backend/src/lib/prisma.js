import { PrismaClient } from "@prisma/client";

// The database is remote (Render, Ohio) and the round trip is long enough that a
// pooled connection sometimes goes away between requests — an idle socket the
// load balancer has quietly closed. Prisma only discovers this when it tries to
// use it, and reports P1001 "Can't reach database server", which the route turns
// into a 500 and the page turns into an empty section.
//
// The connection itself almost always comes straight back, so the fix is to try
// again rather than to fail the request. Only genuinely transient connection
// codes are retried; a bad query or a constraint violation still throws at once.
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
  return /can't reach database server|connection pool|closed the connection|connection reset/i
    .test(String(err.message || ""));
}

const ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createClient() {
  const base = new PrismaClient({ log: ["warn", "error"] });

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
            // 200ms, then 400ms — long enough for a new connection on a slow
            // link, short enough that the request doesn't feel hung
            await sleep(200 * attempt);
            // eslint-disable-next-line no-console
            console.warn(
              `[db] ${err.code || err.name} on ${model ?? "raw"}.${operation} — retry ${attempt}/${ATTEMPTS - 1}`,
            );
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
