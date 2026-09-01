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

# NEXT_PUBLIC_* variables are inlined into the client JS bundle by
# `next build` itself — reading process.env for them at runtime does
# nothing, they have to be present during THIS build step. Railway (like
# any Dockerfile-based builder) only passes a configured variable into the
# build as a --build-arg when the Dockerfile declares a matching ARG, so
# without this the push-subscribe button silently no-ops forever
# (component sees an empty key and returns early) no matter what's set in
# the Railway dashboard's Variables tab.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

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
