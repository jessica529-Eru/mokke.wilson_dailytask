#!/bin/sh
set -e

# DATA_DIR is the single persistent Railway volume mount point (see
# docs/deploy-railway.md). DATABASE_URL and UPLOAD_DIR (set as Railway
# env vars, both pointing under DATA_DIR) are what actually make the
# SQLite file and uploaded images survive a redeploy — this just makes
# sure the directory exists before anything tries to write into it.
DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
# UPLOAD_DIR is a separate env var (see lib/uploads.ts) that also lives
# under the volume — create it here too so the first upload request never
# races container boot, and so a missing/unwritable mount fails loudly at
# startup instead of as a 500 on someone's first avatar upload.
if [ -n "$UPLOAD_DIR" ]; then
  mkdir -p "$UPLOAD_DIR"
fi

npx prisma migrate deploy
npm run db:seed

exec npm start
