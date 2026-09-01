# Debian-based (not alpine): Prisma's generated query engine binary for
# this project is compiled against debian-openssl-3.0.x, which needs glibc
# + OpenSSL 3, not musl.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Placeholder so `next build` never needs a real database connection —
# no page/route queries the DB at build time (see docs/deploy-railway.md),
# this only exists so Prisma's client construction doesn't blow up on a
# missing env var during the build layer.
ENV DATABASE_URL="file:./build-placeholder.db"

# NODE_ENV=production must NOT be set before `npm ci`: this repo has no
# standalone-output trimming, so tsx/dotenv/prisma (all devDependencies)
# are needed at runtime too — `npm run db:seed` (tsx) and even
# `prisma generate` itself (prisma.config.ts does `import "dotenv/config"`)
# both broke when NODE_ENV=production caused `npm ci` to skip
# devDependencies, reproduced locally against a clean install. Setting it
# only after `npm ci` keeps every install full while still marking the
# final running process as production for Next's own runtime behavior.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

RUN chmod +x docker/entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["docker/entrypoint.sh"]
