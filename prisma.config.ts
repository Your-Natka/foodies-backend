/// <reference types="node" />

import "dotenv/config";
import { defineConfig } from "prisma/config";

const isTestDatabase = process.env.PRISMA_TEST_DATABASE === "true";

const databaseUrl = isTestDatabase
  ? process.env.TEST_DATABASE_URL
  : (process.env.DIRECT_URL ?? process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    isTestDatabase
      ? "TEST_DATABASE_URL is not defined"
      : "DATABASE_URL or DIRECT_URL is not defined",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: databaseUrl,
  },
});
