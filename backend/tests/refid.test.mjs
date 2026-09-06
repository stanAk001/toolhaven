/**
 * The conversion that broke publishing.
 *
 * Leaving a guide's category on "None" sent categoryId: null. The old guard,
 * `Number.isInteger(Number(v)) ? Number(v) : null`, turned that into 0, no
 * category has id 0, and Postgres refused the entire update — so pressing
 * Publish, or even Save, threw a foreign key violation and wrote nothing.
 *
 * The same guard sat on submissions' logoUploadId, where a founder who did not
 * upload a logo could not submit their tool at all.
 */
import { refId, existingRefId } from "../src/lib/refid.js";

let pass = 0, fail = 0;
const is = (got, want, what) => {
  if (got === want) { pass++; }
  else { fail++; console.log(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

// --- the empty cases that used to become zero ------------------------------
is(refId(null), null, 'null — "no category selected"');
is(refId(undefined), null, "undefined — the field was not sent");
is(refId(""), null, "an empty string from an untouched <select>");
is(refId(0), null, "a literal zero is not a row id");
is(refId("0"), null, 'the string "0" either');
is(refId(-3), null, "a negative id");
is(refId(NaN), null, "NaN");

// --- real ids still pass ---------------------------------------------------
is(refId(39), 39, "a real category id");
is(refId("39"), 39, "the same id as a string, which is how a form sends it");
is(refId(1), 1, "id 1");

// --- nonsense ---------------------------------------------------------------
is(refId("abc"), null, "a non-numeric string");
is(refId(4.5), null, "a fractional id");
is(refId({}), null, "an object");
is(refId([]), null, "an empty array (Number([]) is 0, which is the same trap)");
is(refId(true), null, "a boolean (Number(true) is 1 — must not become id 1)");

// --- and the existence check ------------------------------------------------
const fakeModel = {
  findUnique: async ({ where }) => ([39, 40, 41].includes(where.id) ? { id: where.id } : null),
};

const run = async () => {
  is(await existingRefId(39, fakeModel), 39, "an id that exists comes back");
  is(await existingRefId(999, fakeModel), null, "an id that does not is cleared, not thrown");
  is(await existingRefId(null, fakeModel), null, "null never reaches the database");
  is(await existingRefId(0, fakeModel), null, "nor does zero");

  // A deleted category must not take an editor's whole save down with it.
  let asked = 0;
  const counting = { findUnique: async () => { asked++; return null; } };
  await existingRefId(null, counting);
  is(asked, 0, "an empty value costs no query at all");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};
run();
