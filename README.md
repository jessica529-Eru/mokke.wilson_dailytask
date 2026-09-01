# 雙人任務集點競爭 App

雙人任務集點競爭 PWA。實作依據：`PROJECT_SPEC_v2.md`（房間卷軸契約建立流程、任務系統、拉鋸戰首頁視覺化）。

## 技術棧

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Prisma 6 + SQLite
- 身份驗證：房間名稱 + 個人密碼（cookie session，`jose` 簽發 JWT）

## 開發環境設定

```bash
npm install
cp .env.example .env   # 若不存在則手動建立，見下方環境變數
npx prisma migrate dev # 建立本地 SQLite 資料庫並套用 schema
npm run db:seed        # 匯入系統預設印章圖示庫
npm run dev
```

開啟 http://localhost:3000。

### 環境變數（`.env`）

```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="<random 32-byte hex>"
```

`SESSION_SECRET` 可用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 產生。

## 目前實作範圍

依 `PROJECT_SPEC_v2.md` 第 13 節優先順序，已完成第 1、2、3、4、6、8、9、10、11、12、13、15 項：

1. Room / RoomMember / 邀請碼與登入機制
2. RoomCreationDraft 卷軸契約往返流程（含蓋章/退回動畫、無限次來回修改）
3. TaskTemplate（daily / extra_normal / extra_quota，含 assign_scope）/ TaskCompletion
4. TaskApprovalRequest 核准流程（含逾期自動核准/拒絕）
5. IconAsset 圖示資產庫（靜態 SVG，動畫影格未做）
6. 月曆蓋章視覺（`/rooms/[id]/calendar`，含 10.9 郵票可見度權限過濾）
7. 首頁拉鋸戰比例尺視覺（即時比例、獎金池、加碼掉落動畫、即時試算）
8. Reward / RewardAssignment / RewardUnlock（`/rooms/[id]/rewards`，含 single_task /
   multi_task_threshold / streak_days 自動解鎖判定）
9. MoneyPoolTopUp 加碼機制與掉落動畫
10. extra_quota 任務與額度獎勵變更（`change_quota_reward` 審核流程 + UI）
11. StreakRecord / RescueVoucherUsage（連續天數計算、補救券使用與回補後的
    連續天數重新計算）
12. 驚喜任務觸發機制
13. SettlementRecord 結算邏輯（詳見下方「結算機制」小節）
14. Notification 全類型（`/rooms/[id]/notifications`，站內未讀提示；尚無
    Web Push 推播）
15. AuditLog（無 UI，寫入卷軸核准、任務審核、加碼、結算等關鍵操作）

### 結算機制設計取捨

- 沒有背景排程器，改採「惰性觸發」：任何讀取 `/api/rooms/:id/scores` 或
  `/api/rooms/:id/settlements` 的請求，都會先檢查 `Room.settlementDate`
  是否已過期，過期且尚未結算則立即執行結算（`src/lib/settlement.ts`）。
- 積分「歸零」不是刪除 `TaskCompletion`，而是把計分範圍改成「自上次結算
  以來」——`/scores` 與結算計算都以此為準，歷史紀錄完整保留。
- `settlementDate` 的設定/更新目前是任一方可直接設定（比照加碼，不走
  `room_settings_change` 審核流程），保留該 request type 供未來擴充。
- 額度已用完的 `extra_quota` 沿用/封存（10.13）由使用者手動決定，尚無對應
  UI；結算時只處理「未用完額度作廢」（10.11 第 2 點）。

尚未實作：Web Push 通知、卷軸契約以外的 `room_settings_change` 審核 UI、
IconAsset 多影格動畫、額度沿用/封存 UI。

## 專案結構

- `prisma/schema.prisma` — 完整資料模型
- `src/app/api/**` — Route Handlers（REST-ish API）
- `src/app/(pages)` — 房間建立、加入、登入、房間內首頁/任務/審核頁面
- `src/lib/**` — session、密碼雜湊、房間草稿解析、任務生命週期等共用邏輯
- `public/icons/**` — 系統預設印章圖示庫（SVG 佔位美術）
