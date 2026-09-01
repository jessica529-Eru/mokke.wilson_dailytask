-- Deduplicate settlement_records before adding the unique constraint below.
-- runSettlementIfDue's lazy trigger could fire from two concurrent
-- requests before this fix, both seeing "not settled yet" and both
-- inserting a row for the same (room_id, period_end) — this happened on
-- at least one live room. Keep the earliest row per (room_id, period_end)
-- and drop the rest; the surviving row already carries the correct
-- member_scores/final_money_pool/money_distribution for that period.
DELETE FROM "settlement_records"
WHERE "id" NOT IN (
  SELECT MIN("id") FROM "settlement_records" GROUP BY "room_id", "period_end"
);

-- CreateIndex
CREATE UNIQUE INDEX "settlement_records_room_id_period_end_key" ON "settlement_records"("room_id", "period_end");
