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

Web Push 需要另外三個變數（沒有設定時，站內通知照常運作，只是不會有瀏覽器推播）：

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:you@example.com"
```

用 `npx web-push generate-vapid-keys` 產生金鑰。

## 目前實作範圍

依 `PROJECT_SPEC_v2.md` 第 13 節優先順序，15 項全部完成：

1. Room / RoomMember / 邀請碼與登入機制
2. RoomCreationDraft 卷軸契約往返流程（含蓋章/退回動畫、無限次來回修改）
3. TaskTemplate（daily / extra_normal / extra_quota，含 assign_scope）/ TaskCompletion
4. TaskApprovalRequest 核准流程（含逾期自動核准/拒絕）
5. IconAsset 圖示資產庫（預設印章皆為 3 影格：落下→蓋下→定格，前端
   `FrameStamp` 元件播放）
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
14. Notification 全類型（`/rooms/[id]/notifications` 站內未讀提示 +
    Web Push 瀏覽器推播，詳見下方「Web Push」小節）
15. AuditLog（無 UI，寫入卷軸核准、任務審核、加碼、結算等關鍵操作）

### 結算機制設計取捨

- 沒有背景排程器，改採「惰性觸發」：任何讀取 `/api/rooms/:id/scores` 或
  `/api/rooms/:id/settlements` 的請求，都會先檢查 `Room.settlementDate`
  是否已過期，過期且尚未結算則立即執行結算（`src/lib/settlement.ts`）。
- 積分「歸零」不是刪除 `TaskCompletion`，而是把計分範圍改成「自上次結算
  以來」——`/scores` 與結算計算都以此為準，歷史紀錄完整保留。
- `settlementDate` 首次設定是房間建立卷軸契約的一部分（`RoomCreationDraft.
  contentSnapshot.settlementDate`），跟著契約一起經過雙方同意才生效；房間
  成立後要再變更，會建立 `room_settings_change` 審核請求，需要對方同意才
  會真的套用到 `Room.settlementDate`（`POST /api/rooms/:id/settlement-date`
  只負責建立請求，實際套用在 `applyApprovalOutcome`）。
- 額度任務（`extra_quota`）在每次結算時，所有進行中範本的 `quota_used`
  一律重置為 0，`quota_total` 不變——不分是否用完，下一期自動可以再做滿
  額度，不需要使用者手動選擇沿用或封存。

### Web Push

- 站內通知（`Notification` 表）是唯一真實來源；`lib/notify.ts` 每建立一筆
  通知，會順手（fire-and-forget，不等待、不影響原本請求）呼叫
  `lib/push.ts` 嘗試推播，失敗（未訂閱、VAPID 未設定、endpoint 已失效）
  都是靜默略過，不影響主流程。
- 訂閱資料存在 `PushSubscription`（不在規格書第 9 節資料模型內，屬於
  Web Push 傳輸層的實作細節，一個成員可以有多筆，對應多個裝置/瀏覽器）。
- Service worker（`public/sw.js`）處理 `push` 事件顯示通知、
  `notificationclick` 事件把使用者帶回通知頁。
- 房間內頁首右上角有「啟用推播通知」按鈕（`PushNotificationToggle`），
  會請求瀏覽器通知權限並訂閱。iOS Safari 對 Web Push 支援有限（需先加到
  主畫面成為 PWA），站內通知中心是這類情況下的備援，符合規格書第 12 節
  的技術棧備註。

**測試方式**：`docs/manual-testing-checklist.md` 記錄了自動化測試能驗證
的範圍（manifest、service worker、UI 訂閱流程），以及為什麼真正的推播
送達必須由人在真實瀏覽器/裝置上測，附上桌面/Android/iOS 各自的操作步驟。

### 圖片上傳

- `POST /api/uploads`（multipart/form-data，欄位名 `file`）接受
  JPEG/PNG/WebP/GIF、單檔上限 5MB，存到本機 `public/uploads/`（規格書
  第 12 節允許的「本地/雲端儲存」兩個選項中，本地是這裡的預設，沒有配置
  任何雲端憑證；要換成 S3 相容服務只需要改 `src/lib/uploads.ts` 這一個
  函式）。回傳 `{ url: "/uploads/xxx.png" }`。
- 這個端點刻意不需要登入：大頭貼上傳發生在「房間創建者/加入者都還沒有
  session」的時間點，沒有成員可以驗證身份；驗證改為嚴格限制檔案類型/
  大小，且整個 app 是邀請碼制、非公開註冊，可接受這個取捨。
- 前端：`ImageUploadField`（單張，大頭貼，`/new-room`、`/join` 都有接上）、
  `MultiImageUploadField`（最多 4 張，任務完成時的證明照片，`/rooms/[id]
  /tasks` 完成表單接上）。兩者都會先呼叫上傳端點拿到 URL，再把 URL 一起
  送進原本就存在的 `avatarUrl` / `proofImageUrls` 欄位——後端資料模型完全
  沒變，只是把「使用者自己貼網址」換成「真的上傳檔案」。
- 連帶修正：`avatarUrl` / `proofImageUrls` / `contentImageUrls` 原本用
  `z.string().url()` 驗證，會拒絕 `/uploads/xxx.png` 這種相對路徑；改用
  `src/lib/zodHelpers.ts` 的 `imageUrlSchema`（同時接受絕對網址與同源相對
  路徑）。

## 專案結構

- `prisma/schema.prisma` — 完整資料模型
- `src/app/api/**` — Route Handlers（REST-ish API）
- `src/app/(pages)` — 房間建立、加入、登入、房間內首頁/任務/審核頁面
- `src/lib/**` — session、密碼雜湊、房間草稿解析、任務生命週期等共用邏輯
- `public/icons/**` — 系統預設印章圖示庫（SVG 佔位美術）
