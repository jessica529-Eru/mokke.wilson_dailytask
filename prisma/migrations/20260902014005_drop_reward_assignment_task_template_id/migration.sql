-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reward_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reward_id" INTEGER NOT NULL,
    "unlock_condition_type" TEXT NOT NULL,
    "unlock_condition_value" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_assignments_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_reward_assignments" ("created_at", "id", "reward_id", "unlock_condition_type", "unlock_condition_value") SELECT "created_at", "id", "reward_id", "unlock_condition_type", "unlock_condition_value" FROM "reward_assignments";
DROP TABLE "reward_assignments";
ALTER TABLE "new_reward_assignments" RENAME TO "reward_assignments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
