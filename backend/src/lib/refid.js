/**
 * Coercing a value into a foreign key id.
 *
 * This exists because of one of JavaScript's nastier conversions:
 *
 *     Number(null)            === 0
 *     Number("")              === 0
 *     Number.isInteger(0)     === true
 *
 * So the obvious-looking guard
 *
 *     Number.isInteger(Number(v)) ? Number(v) : null
 *
 * turns "no category selected" into "category number zero". No row has id 0, so
 * Postgres rejects the whole write with a foreign key violation, and the editor
 * sees a five-hundred error and a stack trace for the crime of leaving a
 * dropdown on "None". It blocked publishing and saving alike.
 *
 * A relation id is a positive integer or it is nothing.
 */
export function refId(v) {
  // Only a number or a string may name an id. Booleans and arrays convert to
  // numbers too — Number(true) is 1, Number([]) is 0 — and an id is not the
  // sort of thing anyone means to send as `true`.
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The same, but the id must also name a row that exists.
 *
 * A perfectly well-formed id pointing at a deleted row fails in exactly the
 * same way as zero did, and it is not the editor's fault either — a category
 * can be removed while their tab is open. Anything that does not resolve comes
 * back as null, so the save succeeds with the relation cleared rather than
 * failing entirely and losing everything else they wrote.
 *
 * @param {number|null} id
 * @param {{findUnique: Function}} model  a Prisma delegate
 */
export async function existingRefId(id, model) {
  const n = refId(id);
  if (n === null) return null;
  const row = await model.findUnique({ where: { id: n }, select: { id: true } });
  return row ? n : null;
}
