#!/bin/sh
set -e

# DATA_DIR is the single persistent Railway volume mount point (see
# docs/deploy-railway.md). DATABASE_URL and UPLOAD_DIR (set as Railway
# env vars, both pointing under DATA_DIR) are what actually make the
# SQLite file and uploaded images survive a redeploy — this just makes
# sure the directory exists before anything tries to write into it.
DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"

npx prisma migrate deploy
npm run db:seed

exec npm start
