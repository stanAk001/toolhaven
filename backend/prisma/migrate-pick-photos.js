/**
 * Give each guide pick a photo gallery.
 *
 * Additive only. It creates GuidePickPhoto and copies each pick's existing
 * single imageId in as photo zero, so nothing that already reads `imageId`
 * changes behaviour and no row is touched destructively. Counts are taken
 * before and after and printed, because "the migration ran" and "the data
 * survived" are different claims.
 *
 *   node prisma/migrate-pick-photos.js          # report only
 *   node prisma/migrate-pick-photos.js --apply  # do it
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."${name}"') IS NOT NULL AS present`);
  return rows[0]?.present === true;
}

async function main() {
  const before = {
    guides: await prisma.buyingGuide.count(),
    picks: await prisma.guidePick.count(),
    uploads: await prisma.upload.count(),
    picksWithImage: await prisma.guidePick.count({ where: { imageId: { not: null } } }),
  };
  console.log("before:", before);

  if (!(await tableExists("GuidePickPhoto"))) {
    console.log('\nThe GuidePickPhoto table does not exist yet.');
    console.log('Create it first with:  npx prisma db push');
    console.log('then run this again with --apply to copy the existing images in.');
    return;
  }

  const existing = await prisma.guidePickPhoto.count();
  const picks = await prisma.guidePick.findMany({
    where: { imageId: { not: null } },
    select: { id: true, imageId: true, imageAlt: true, photos: { select: { id: true } } },
  });

  // Only picks that have an image and no gallery yet. Running this twice must
  // not produce two copies of the same photo.
  const todo = picks.filter((p) => p.photos.length === 0);
  console.log(`\n${picks.length} picks carry an image; ${todo.length} need one copied into the gallery.`);

  if (!APPLY) {
    console.log("\nReport only. Re-run with --apply to write.");
    return;
  }

  let made = 0;
  for (const p of todo) {
    await prisma.guidePickPhoto.create({
      data: { pickId: p.id, uploadId: p.imageId, alt: p.imageAlt || null, position: 0 },
    });
    made++;
  }

  const after = {
    guides: await prisma.buyingGuide.count(),
    picks: await prisma.guidePick.count(),
    uploads: await prisma.upload.count(),
    picksWithImage: await prisma.guidePick.count({ where: { imageId: { not: null } } }),
    photos: await prisma.guidePickPhoto.count(),
  };
  console.log("\nafter:", after);
  console.log(`photos created: ${made} (there were ${existing} before)`);

  const lost = ["guides", "picks", "uploads", "picksWithImage"].filter((k) => after[k] !== before[k]);
  console.log(lost.length
    ? `\nFAILED — these counts changed and should not have: ${lost.join(", ")}`
    : "\nEvery pre-existing count is unchanged. Nothing was overwritten or deleted.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
