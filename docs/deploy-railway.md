# 部署到 Railway

這份清單假設你已經有 Railway 帳號（railway.app，可以用 GitHub 登入）。跟著做，
不需要看懂程式碼。全部步驟都在網頁上點,大概 10 分鐘。

## 為什麼是 Railway

這個 app 用 SQLite（存在磁碟上的檔案）當資料庫，圖片上傳也存在磁碟上，所以
部署平台一定要支援「持久化硬碟」（Volume），純 serverless 的 Vercel 不適合。
Railway 設定簡單、有持久化 volume、對 Dockerfile 部署原生支援，是這個專案
最省事的選擇。

## 步驟

### 1. 建立專案並接上這個 repo

1. 登入 [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub repo**
3. 選擇 `jessica529-Eru/mokke.wilson_dailytask`,分支選 `claude/new-session-2ti00d`
   （或之後如果已經合併到 `main`，就選 `main`）
4. Railway 會偵測到 repo 根目錄有 `Dockerfile`，自動用它來 build，不需要另外
   設定 build/start command

### 2. 設定環境變數

專案頁面 → 你的服務 → **Variables** 分頁，把下面這幾行整段貼上（Railway
支援貼上多行 `KEY=VALUE` 一次匯入），把 `<...>` 換成實際值：

```
DATABASE_URL=file:/app/data/app.db
UPLOAD_DIR=/app/data/uploads
SESSION_SECRET=<隨機值，見下方>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID 公鑰，見下方>
VAPID_PRIVATE_KEY=<VAPID 私鑰，見下方>
VAPID_SUBJECT=mailto:you@example.com
```

`SESSION_SECRET` 跟兩把 VAPID 金鑰**故意不寫進這份文件**——這份文件會進
git 歷史，一旦 commit，就算之後改掉這個檔案，舊版本裡的值還是找得到，
正式環境的密鑰不適合這樣處理。實際數值請 Claude 直接在對話裡貼給你（
只在那次對話出現，不會進 repo），或者你也可以自己產生：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET
npx web-push generate-vapid-keys                                            # VAPID 兩把
```

- 把 `VAPID_SUBJECT` 的 `you@example.com` 換成你自己的信箱（推播規範要求
  一個聯絡方式，換不換不影響功能，但建議換成真的信箱）。
- **不要**自己加 `PORT` 這個變數，Railway 會自動注入，`next start` 本來就
  會讀它。

### 3. 掛載持久化 Volume

同一個服務頁面 → **Settings → Volumes → Add Volume**：

- Mount path 填：`/app/data`

這是資料庫檔案（`app.db`）和使用者上傳的圖片實際存放的地方。**這一步不能
跳過**，沒掛 volume 的話，每次重新部署資料都會消失。

### 4. 開啟對外網址

**Settings → Networking → Generate Domain**，Railway 會給你一個
`https://xxx.up.railway.app` 的網址（也可以之後在這裡接自訂網域）。

### 5. 觸發部署

如果前面步驟做完 Railway 沒有自動開始 build，手動點 **Deploy**。第一次
build 會跑：`npm ci` → `next build`，接著容器啟動時會自動跑資料庫
migration 和印章圖示庫的 seed（`docker/entrypoint.sh`），這兩步之後每次
重啟都會再跑一次，但都是安全的重複執行（已用資料驗證過）。

## 部署後驗證

打開 Railway 給的網址，照這個順序點一輪：

1. 首頁應該出現「建立新房間」「使用邀請碼加入」「登入既有房間」
2. 建一個房間，上傳大頭貼，確認送出後在下一頁看得到大頭貼縮圖（這一步
   直接測到「圖片上傳」跟「持久化 volume」兩件事有沒有接對）
3. 用另一個瀏覽器（或無痕視窗）用邀請碼加入
4. 兩人都同意契約後，進到房間首頁，確認拉鋸戰視覺正常顯示
5. 右上角點「啟用推播通知」，允許瀏覽器通知權限；讓另一人觸發一個會通知
   你的動作（例如加碼），確認你收到系統推播通知（詳細測試步驟見
   `docs/manual-testing-checklist.md`）

如果第 2 步大頭貼上傳後重新整理就不見了，代表 volume 沒掛對，回頭檢查
步驟 3 的 mount path 是不是精確填 `/app/data`。

## 之後更新程式碼

Railway 預設會在你 push 到接上的分支時自動重新部署。如果你之後把
`claude/new-session-2ti00d` 合併進 `main`，記得回到 Railway 專案設定，把
自動部署的分支改成 `main`。

## 如果之後想改用真的雲端資料庫/檔案儲存

目前是 SQLite + 本機磁碟，適合這種兩人小規模使用。如果之後想換成 Postgres
（例如 Railway 自己就有一鍵加 Postgres 服務）或 S3 相容的圖片儲存，需要
調整的地方：

- 資料庫：`prisma/schema.prisma` 的 `datasource db { provider = "sqlite" }`
  改成 `"postgresql"`，`DATABASE_URL` 改成 Postgres 連線字串，重新跑一次
  `prisma migrate dev` 產生對應的 migration。
- 圖片：`src/lib/uploads.ts` 的 `saveUploadedImage` 換成呼叫 S3 相容
  服務的 SDK，`src/app/uploads/[filename]/route.ts` 這個自製的檔案伺服
  端點就不再需要（直接把 URL 換成雲端儲存給的公開網址）。

這兩個改動都不影響其他業務邏輯，是刻意設計成容易抽換的。
