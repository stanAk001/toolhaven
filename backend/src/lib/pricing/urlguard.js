/**
 * The gate every outbound request passes through.
 *
 * This subsystem fetches URLs derived from database rows, which makes it a
 * server-side request forgery primitive unless it is deliberately not one. The
 * classic attack is not a private URL in the database — it is a public hostname
 * that resolves to 169.254.169.254 (the cloud metadata endpoint), or a public
 * page that 302s there. So hostnames are resolved and the *addresses* are
 * judged, and every redirect hop is judged again rather than trusted because
 * the first hop passed.
 *
 * Deny by default: an address has to fall outside every reserved range to be
 * allowed, rather than inside a list of known-bad ones.
 */
import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "UnsafeUrlError";
    this.safe = true; // carries no internal detail; safe to log
  }
}

const ipv4ToInt = (ip) => ip.split(".").reduce((n, o) => (n << 8 >>> 0) + Number(o), 0) >>> 0;
const inRange = (ip, cidr) => {
  const [base, bits] = cidr.split("/");
  const mask = bits === "0" ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
};

// Everything that is not ordinary public internet.
const BLOCKED_V4 = [
  "0.0.0.0/8",        // this host
  "10.0.0.0/8",       // private
  "100.64.0.0/10",    // carrier-grade NAT
  "127.0.0.0/8",      // loopback
  "169.254.0.0/16",   // link-local — cloud metadata lives here
  "172.16.0.0/12",    // private
  "192.0.0.0/24",     // IETF protocol assignments
  "192.0.2.0/24",     // documentation
  "192.88.99.0/24",   // 6to4 relay anycast
  "192.168.0.0/16",   // private
  "198.18.0.0/15",    // benchmarking
  "198.51.100.0/24",  // documentation
  "203.0.113.0/24",   // documentation
  "224.0.0.0/4",      // multicast
  "240.0.0.0/4",      // reserved, includes broadcast
];

export function isPublicAddress(ip) {
  if (net.isIPv4(ip)) return !BLOCKED_V4.some((c) => inRange(ip, c));

  if (net.isIPv6(ip)) {
    const a = ip.toLowerCase();
    if (a === "::1" || a === "::") return false;
    // An IPv4 address wearing an IPv6 costume still goes where the v4 goes.
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    if (/^f[cd]/.test(a)) return false;          // fc00::/7 unique local
    if (/^fe[89ab]/.test(a)) return false;       // fe80::/10 link local
    if (a.startsWith("2001:db8")) return false;  // documentation
    if (a.startsWith("64:ff9b:")) return false;  // NAT64 — a v4 address in disguise
    return true;
  }
  return false;
}

/**
 * Parse, validate and resolve. Returns the URL plus the addresses it resolved
 * to, so the caller can see what it is actually talking to.
 *
 * @throws {UnsafeUrlError} with a reason fit for an operator log
 */
export async function assertSafeUrl(raw, { resolve = true } = {}) {
  let url;
  try { url = new URL(String(raw)); }
  catch { throw new UnsafeUrlError("not a valid URL"); }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError(`scheme ${url.protocol} is not allowed`);
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("credentials in URL are not allowed");
  }
  // Only the standard web ports. Anything else is far more likely to be an
  // internal service than a pricing page.
  const port = url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80);
  if (port !== 80 && port !== 443) {
    throw new UnsafeUrlError(`port ${port} is not allowed`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  // A literal address skips DNS but not the range check.
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw new UnsafeUrlError("address is not public");
    return { url, addresses: [host] };
  }

  if (!/^[a-z0-9.-]+$/i.test(host) || host.endsWith(".local") || !host.includes(".")) {
    throw new UnsafeUrlError("hostname is not a public domain name");
  }
  if (!resolve) return { url, addresses: [] };

  let records;
  try { records = await dns.lookup(host, { all: true, verbatim: true }); }
  catch { throw new UnsafeUrlError("hostname does not resolve"); }
  if (!records.length) throw new UnsafeUrlError("hostname does not resolve");

  // Every address, not just the first: a hostname that resolves to one public
  // and one private address must not be reachable through the private one.
  for (const { address } of records) {
    if (!isPublicAddress(address)) throw new UnsafeUrlError("resolves to a non-public address");
  }
  return { url, addresses: records.map((r) => r.address) };
}
