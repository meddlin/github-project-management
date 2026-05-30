import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = process.env.GPM_ENV_FILE
  ? process.env.GPM_ENV_FILE
  : [".env", "../../.env"]
      .map((path) => resolve(packageRoot, path))
      .find((path) => existsSync(path));

config({ path: envFile, quiet: true });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export type { Prisma } from "@prisma/client";
