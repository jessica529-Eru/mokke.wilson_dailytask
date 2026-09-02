-- CreateTable
CREATE TABLE "reward_comments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reward_id" INTEGER NOT NULL,
    "room_member_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_comments_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reward_comments_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reward_reactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reward_id" INTEGER NOT NULL,
    "room_member_id" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '❤️',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_reactions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reward_reactions_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "reward_reactions_reward_id_room_member_id_key" ON "reward_reactions"("reward_id", "room_member_id");
