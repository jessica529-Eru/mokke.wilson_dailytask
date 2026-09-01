import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient();

const DEFAULT_STAMPS: { name: string; file: string }[] = [
  { name: "啞鈴", file: "dumbbell.svg" },
  { name: "太陽", file: "sun.svg" },
  { name: "月亮", file: "moon.svg" },
  { name: "書本", file: "book.svg" },
  { name: "水滴", file: "water-drop.svg" },
  { name: "愛心", file: "heart.svg" },
  { name: "掃把", file: "broom.svg" },
  { name: "星星", file: "star.svg" },
];

async function main() {
  for (const stamp of DEFAULT_STAMPS) {
    const existing = await db.iconAsset.findFirst({
      where: { roomId: null, category: "stamp", name: stamp.name },
    });
    if (existing) continue;
    await db.iconAsset.create({
      data: {
        roomId: null,
        category: "stamp",
        name: stamp.name,
        frameImageUrls: JSON.stringify([`/icons/stamps/${stamp.file}`]),
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
