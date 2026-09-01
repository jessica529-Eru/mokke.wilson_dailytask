-- CreateTable
CREATE TABLE "rooms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invite_code" TEXT NOT NULL,
    "room_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "settlement_cycle_type" TEXT NOT NULL DEFAULT 'custom_date',
    "settlement_date" DATETIME,
    "settlement_timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "overdue_default_result" TEXT NOT NULL DEFAULT 'reject',
    "default_review_days" INTEGER NOT NULL DEFAULT 3,
    "initial_money_pool" DECIMAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "room_members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "display_nickname" TEXT NOT NULL,
    "avatar_url" TEXT,
    "color" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "room_creation_drafts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "proposed_by" INTEGER NOT NULL,
    "content_snapshot" TEXT NOT NULL,
    "item_comments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_creation_drafts_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "room_creation_drafts_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "money_pool_top_ups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "added_by" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "money_pool_top_ups_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "money_pool_top_ups_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "assign_scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_by" INTEGER,
    "assigned_to" INTEGER,
    "points" INTEGER,
    "requires_proof" BOOLEAN NOT NULL DEFAULT false,
    "stamp_icon_asset_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "approval_deadline" DATETIME,
    "quota_total" INTEGER,
    "quota_used" INTEGER NOT NULL DEFAULT 0,
    "streak_counts_toward_daily" BOOLEAN NOT NULL DEFAULT true,
    "trigger_probability" DECIMAL,
    "trigger_target_type" TEXT,
    "trigger_target_task_id" INTEGER,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "task_templates_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "room_members" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_templates_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "room_members" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_templates_stamp_icon_asset_id_fkey" FOREIGN KEY ("stamp_icon_asset_id") REFERENCES "icon_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_templates_trigger_target_task_id_fkey" FOREIGN KEY ("trigger_target_task_id") REFERENCES "task_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_template_id" INTEGER NOT NULL,
    "room_member_id" INTEGER NOT NULL,
    "completed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_local_date" TEXT NOT NULL,
    "proof_text" TEXT,
    "proof_image_urls" TEXT,
    "points_awarded" INTEGER NOT NULL,
    "reward_id" INTEGER,
    "is_makeup" BOOLEAN NOT NULL DEFAULT false,
    "triggered_surprise_task_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_completions_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_completions_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_completions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_completions_triggered_surprise_task_id_fkey" FOREIGN KEY ("triggered_surprise_task_id") REFERENCES "task_completions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_approval_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "task_template_id" INTEGER,
    "request_type" TEXT NOT NULL,
    "requested_by" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "applies_to_completion_index" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "response_deadline" DATETIME,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_approval_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_approval_requests_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_approval_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rewards" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rewards_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rewards_source_task_completion_id_fkey" FOREIGN KEY ("source_task_completion_id") REFERENCES "task_completions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "rewards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reward_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reward_id" INTEGER NOT NULL,
    "task_template_id" INTEGER,
    "unlock_condition_type" TEXT NOT NULL,
    "unlock_condition_value" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_assignments_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reward_assignments_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reward_unlocks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reward_id" INTEGER NOT NULL,
    "room_member_id" INTEGER NOT NULL,
    "unlocked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_unlocks_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reward_unlocks_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "streak_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "room_member_id" INTEGER NOT NULL,
    "streak_type" TEXT NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_active_local_date" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "streak_records_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "streak_records_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rescue_voucher_usages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_member_id" INTEGER NOT NULL,
    "reward_id" INTEGER NOT NULL,
    "makeup_for_date" TEXT NOT NULL,
    "used_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rescue_voucher_usages_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rescue_voucher_usages_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settlement_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "period_start" DATETIME NOT NULL,
    "period_end" DATETIME NOT NULL,
    "member_scores" TEXT NOT NULL,
    "final_money_pool" DECIMAL NOT NULL,
    "money_distribution" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_records_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "room_member_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "room_members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "icon_assets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frame_image_urls" TEXT NOT NULL,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "icon_assets_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "icon_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "room_members" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "actor_room_member_id" INTEGER,
    "action_type" TEXT NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "target_entity_id" INTEGER NOT NULL,
    "change_summary" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_actor_room_member_id_fkey" FOREIGN KEY ("actor_room_member_id") REFERENCES "room_members" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_invite_code_key" ON "rooms"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_name_key" ON "rooms"("room_name");

-- CreateIndex
CREATE UNIQUE INDEX "room_members_room_id_password_key" ON "room_members"("room_id", "password");

-- CreateIndex
CREATE UNIQUE INDEX "room_creation_drafts_room_id_version_key" ON "room_creation_drafts"("room_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_triggered_surprise_task_id_key" ON "task_completions"("triggered_surprise_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_source_task_completion_id_key" ON "rewards"("source_task_completion_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_unlocks_reward_id_room_member_id_key" ON "reward_unlocks"("reward_id", "room_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "streak_records_room_id_room_member_id_streak_type_key" ON "streak_records"("room_id", "room_member_id", "streak_type");
