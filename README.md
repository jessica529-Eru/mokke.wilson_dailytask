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

依 `PROJECT_SPEC_v2.md` 第 13 節優先順序，已完成第 1–4 項的完整資料模型與核心流程：

1. Room / RoomMember / 邀請碼與登入機制
2. RoomCreationDraft 卷軸契約往返流程（含蓋章/退回動畫、無限次來回修改）
3. TaskTemplate（daily / extra_normal / extra_quota，含 assign_scope）/ TaskCompletion
4. TaskApprovalRequest 核准流程（含逾期自動核准/拒絕）

另外提前完成了與上述流程緊密相關的部分：

- 首頁拉鋸戰視覺化（即時比例、獎金池、加碼、即時試算）
- 月曆蓋章所需的資料層（IconAsset 圖示庫、Reward 郵票自動產生）
- 驚喜任務隨機觸發機制（完成任務時擲骰、產生系統任務、不遞迴觸發）
- 通知中心資料層（Notification 建立，尚無 Web Push）

Prisma schema（`prisma/schema.prisma`）已涵蓋規格書第 9 節全部資料表，尚未實作 UI/邏輯的部分（月曆視覺、結算流程、連續天數/補救券完整互動、Web Push 通知）留待後續迭代。

## 專案結構

- `prisma/schema.prisma` — 完整資料模型
- `src/app/api/**` — Route Handlers（REST-ish API）
- `src/app/(pages)` — 房間建立、加入、登入、房間內首頁/任務/審核頁面
- `src/lib/**` — session、密碼雜湊、房間草稿解析、任務生命週期等共用邏輯
- `public/icons/**` — 系統預設印章圖示庫（SVG 佔位美術）
