import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const isTest = process.env.NODE_ENV === "test";

const databaseUrl = isTest
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    isTest ? "TEST_DATABASE_URL is not defined" : "DATABASE_URL is not defined",
  );
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
