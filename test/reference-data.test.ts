import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL to run PostgreSQL integration tests");
}

const databaseName = `foodies_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const admin = new pg.Client({ connectionString: databaseUrl.href });
databaseUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = databaseUrl.href;

let databaseCreated = false;
let prisma: typeof import("../prisma/client.ts").default;
let server: Server | undefined;
let baseUrl: string;

const firstId = "100000000000000000000001";
const secondId = "100000000000000000000002";
const thirdId = "100000000000000000000003";

before(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;

  const migration = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)),
    "migrate", "deploy",
  ], { env: process.env, encoding: "utf8", timeout: 30000 });
  assert.equal(migration.status, 0, migration.stderr + migration.stdout);

  prisma = (await import("../prisma/client.ts")).default;
  const app = (await import("../src/app.ts")).default;
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
}, { timeout: 45000 });

after(async () => {
  try {
    if (server) {
      const runningServer = server;
      await new Promise<void>((resolve, reject) => {
        runningServer.close((error) => error ? reject(error) : resolve());
      });
    }
    if (prisma) await prisma.$disconnect();
    if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }
});

const getList = async (path: string) => {
  const response = await fetch(`${baseUrl}/${path}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
  return response.json();
};

test("порожні довідники й відгуки доступні гостю", async () => {
  for (const path of ["categories", "areas", "ingredients", "testimonials"]) {
    assert.deepEqual(await getList(path), { data: [] }, path);
  }
});

test("категорії та регіони впорядковані за назвою, потім за ID", async () => {
  const categories = [
    { id: secondId, name: "Dessert" },
    { id: thirdId, name: "Seafood" },
    { id: firstId, name: "Dessert" },
  ];
  const areas = [
    { id: secondId, name: "Greek" },
    { id: thirdId, name: "Japanese" },
    { id: firstId, name: "Greek" },
  ];
  await prisma.category.createMany({ data: categories });
  await prisma.area.createMany({ data: areas });

  assert.deepEqual(await getList("categories"), {
    data: [categories[2], categories[0], categories[1]],
  });
  assert.deepEqual(await getList("areas"), {
    data: [areas[2], areas[0], areas[1]],
  });
});

test("інгредієнти повертають тільки поля контракту, включно з null", async () => {
  const image = "https://example.com/apple.png";
  await prisma.ingredient.createMany({ data: [
    { id: secondId, name: "Apple", img: null },
    { id: thirdId, name: null, img: null },
    { id: firstId, name: "Apple", img: image, description: "A fruit" },
  ] });

  assert.deepEqual(await getList("ingredients"), { data: [
    { id: firstId, name: "Apple", img: image },
    { id: secondId, name: "Apple", img: null },
    { id: thirdId, name: null, img: null },
  ] });
});

test("відгуки впорядковані за ID та повертають лише ID й ім'я автора", async () => {
  const owner = { id: thirdId, name: "Olena" };
  await prisma.user.create({ data: {
    ...owner,
    email: "olena@example.com",
    password: "fixture-password",
    avatar: "https://example.com/avatar.png",
    refreshTokenHash: "fixture-hash",
    sessionExpiresAt: new Date("2026-01-01T00:00:00Z"),
  } });
  await prisma.testimonial.createMany({ data: [
    { id: secondId, testimonial: "Easy to use.", ownerId: owner.id },
    { id: firstId, testimonial: "Great recipes!", ownerId: owner.id },
  ] });

  assert.deepEqual(await getList("testimonials"), { data: [
    { id: firstId, testimonial: "Great recipes!", owner },
    { id: secondId, testimonial: "Easy to use.", owner },
  ] });
});
