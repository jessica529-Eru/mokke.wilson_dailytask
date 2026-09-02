-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_rewards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_text" TEXT,
    "content_image_urls" TEXT,
    "stock_total" INTEGER,
    "stock_remaining" INTEGER,
    "source_task_completion_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rewards_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rewards_source_task_completion_id_fkey" FOREIGN KEY ("source_task_completion_id") REFERENCES "task_completions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "rewards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_rewards" ("content_image_urls", "content_text", "created_at", "created_by", "id", "room_id", "source_task_completion_id", "stock_remaining", "stock_total", "title", "type") SELECT "content_image_urls", "content_text", "created_at", "created_by", "id", "room_id", "source_task_completion_id", "stock_remaining", "stock_total", "title", "type" FROM "rewards";
DROP TABLE "rewards";
ALTER TABLE "new_rewards" RENAME TO "rewards";
CREATE UNIQUE INDEX "rewards_source_task_completion_id_key" ON "rewards"("source_task_completion_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
