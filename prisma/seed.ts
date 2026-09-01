import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient();

// Frame order matches the stamp animation sequence (section 8.2): falling
// in (faint, small, tilted) -> impact (full opacity, slightly oversized) ->
// settled (the original static artwork).
const DEFAULT_STAMPS: { name: string; base: string }[] = [
  { name: "啞鈴", base: "dumbbell" },
  { name: "太陽", base: "sun" },
  { name: "月亮", base: "moon" },
  { name: "書本", base: "book" },
  { name: "水滴", base: "water-drop" },
  { name: "愛心", base: "heart" },
  { name: "掃把", base: "broom" },
  { name: "星星", base: "star" },
];

function framesFor(base: string) {
  return [`/icons/stamps/${base}-f1.svg`, `/icons/stamps/${base}-f2.svg`, `/icons/stamps/${base}.svg`];
}

async function main() {
  for (const stamp of DEFAULT_STAMPS) {
    const frameImageUrls = JSON.stringify(framesFor(stamp.base));
    const existing = await db.iconAsset.findFirst({
      where: { roomId: null, category: "stamp", name: stamp.name },
    });
    if (existing) {
      await db.iconAsset.update({ where: { id: existing.id }, data: { frameImageUrls } });
      continue;
    }
    await db.iconAsset.create({
      data: {
        roomId: null,
        category: "stamp",
        name: stamp.name,
        frameImageUrls,
        createdById: null,
      },
    });
  }

  const existingFrame = await db.iconAsset.findFirst({
    where: { roomId: null, category: "stamp_frame", name: "標準郵票外框" },
  });
  if (!existingFrame) {
    await db.iconAsset.create({
      data: {
        roomId: null,
        category: "stamp_frame",
        name: "標準郵票外框",
        frameImageUrls: JSON.stringify(["/icons/stamp-frames/default.svg"]),
        createdById: null,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
