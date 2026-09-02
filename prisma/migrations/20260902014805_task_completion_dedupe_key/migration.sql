-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_task_completions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_template_id" INTEGER NOT NULL,
    "room_member_id" INTEGER NOT NULL,
    "completed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_local_date" TEXT NOT NULL,
    "proof_text" TEXT,
    "proof_image_urls" TEXT,
    "points_awarded" INTEGER NOT NULL,
    "reward_id" INTEGER,
    "daily_dedupe_key" TEXT,
    "triggered_surprise_task_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_completions_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_completions_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_completions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_completions_triggered_surprise_task_id_fkey" FOREIGN KEY ("triggered_surprise_task_id") REFERENCES "task_completions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_task_completions" ("completed_at", "completed_local_date", "created_at", "id", "points_awarded", "proof_image_urls", "proof_text", "reward_id", "room_member_id", "task_template_id", "triggered_surprise_task_id") SELECT "completed_at", "completed_local_date", "created_at", "id", "points_awarded", "proof_image_urls", "proof_text", "reward_id", "room_member_id", "task_template_id", "triggered_surprise_task_id" FROM "task_completions";
DROP TABLE "task_completions";
ALTER TABLE "new_task_completions" RENAME TO "task_completions";
CREATE UNIQUE INDEX "task_completions_daily_dedupe_key_key" ON "task_completions"("daily_dedupe_key");
CREATE UNIQUE INDEX "task_completions_triggered_surprise_task_id_key" ON "task_completions"("triggered_surprise_task_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
