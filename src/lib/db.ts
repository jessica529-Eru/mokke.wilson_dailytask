import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The Prisma CLI resolves a relative sqlite "file:" URL relative to
// prisma/schema.prisma's directory. The generated client, once bundled by
// Turbopack/webpack, loses that context and instead resolves it relative to
// whatever chunk directory it ends up in — so we resolve it ourselves here,
// the same way the CLI does, and hand PrismaClient an absolute path.
function resolveDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) return url;
  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) return url;
  const absolutePath = path.resolve(process.cwd(), "prisma", relativePath);
  return `file:${absolutePath}`;
}

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatasourceUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
