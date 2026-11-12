import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import pg from "pg";
import { generateAccessToken, generateRefreshToken } from "../src/utils/generateTokens.ts";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL to run PostgreSQL integration tests");
}

const databaseName = `foodies_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const admin = new pg.Client({ connectionString: databaseUrl.href });
databaseUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = databaseUrl.href;
const jwtSecret = randomUUID();
process.env.JWT_SECRET = jwtSecret;

const viewerId = "100000000000000000000001";
const targetId = "100000000000000000000002";
const otherId = "100000000000000000000003";
const emptyId = "100000000000000000000004";
const unknownId = "100000000000000000000099";

const recipes = Array.from({ length: 6 }, (_, index) => ({
  id: `20000000000000000000000${index + 1}`,
  thumb: `https://example.com/thumb-${index + 1}.jpg`,
}));
const recipePreviews = [recipes[5], recipes[4], recipes[2], recipes[0]];

let databaseCreated = false;
let prisma: typeof import("../prisma/client.ts").default;
let server: Server | undefined;
let baseUrl: string;

before(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;

  const migration = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)),
    "migrate", "deploy",
  ], {
    env: { ...process.env, DIRECT_URL: databaseUrl.href },
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(migration.status, 0, migration.stdout + migration.stderr);

  prisma = (await import("../prisma/client.ts")).default;
  await prisma.user.createMany({
    data: [
      { id: viewerId, name: "Viewer" },
      { id: targetId, name: "Target" },
      { id: otherId, name: "Other" },
      { id: emptyId, name: "Empty" },
    ].map((user) => ({
      ...user,
      email: `${user.name.toLowerCase()}@example.com`,
      password: "fixture-password",
      refreshTokenHash: "fixture-hash",
    })),
  });
  await prisma.recipe.createMany({
    data: recipes.map((recipe, index) => ({
      ...recipe,
      ownerId: otherId,
      title: "Recipe title",
      description: "Recipe description",
      instructions: "Recipe instructions",
      category: "Seafood",
      area: "Greek",
      time: 15,
      createdAt: new Date(index === 1 || index === 3 ? "2026-01-01" : "2026-01-02"),
    })),
  });

  const app = (await import("../src/app.ts")).default;
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}/api/users`;
}, { timeout: 45000 });

beforeEach(async () => {
  await prisma.follow.deleteMany();
});

after(async () => {
  try {
    if (server?.listening) {
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

const createFollow = (followerId: string, followingId: string) =>
  prisma.follow.create({ data: { followerId, followingId } });

const request = (path: string, method = "GET", token = generateAccessToken(viewerId)) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const readCards = async (response: Response) =>
  (await response.json() as { data: { id: string }[] }).data;

test("усі маршрути вимагають access token і забороняють кешування", async () => {
  const paths = [
    ["GET", "/following"],
    ["GET", `/${targetId}/followers`],
    ["PUT", `/${targetId}/follow`],
    ["DELETE", `/${targetId}/follow`],
  ];

  const expiredToken = jwt.sign({ sub: viewerId, type: "access" }, jwtSecret, { expiresIn: -1 });

  for (const [method, path] of paths) {
    for (const token of ["", "invalid", generateRefreshToken(viewerId), expiredToken]) {
      const response = await request(path, method, token);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      await response.json();
    }
  }
  assert.equal(await prisma.follow.count(), 0);
});

test("Followers повертає впорядковану сторінку, стан підписки й до чотирьох прев’ю рецептів", async () => {
  await createFollow(viewerId, targetId);
  await createFollow(otherId, targetId);
  await createFollow(viewerId, otherId);

  const response = await request(`/${targetId}/followers?page=2&limit=1`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: [{ id: otherId, name: "Other", avatar: null, recipesCount: 6, isFollowing: true, recipes: recipePreviews }],
    pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
  });

  const firstPage = await request(`/${targetId}/followers?page=1&limit=1`);
  assert.equal(firstPage.status, 200);
  assert.deepEqual(await readCards(firstPage), [{
    id: viewerId, name: "Viewer", avatar: null, recipesCount: 0, isFollowing: false, recipes: [],
  }]);
});

test("Following використовує профіль із токена та повертає порожні сторінки", async () => {
  await createFollow(otherId, targetId);
  const empty = await request("/following");
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), {
    data: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
  });

  await createFollow(viewerId, targetId);
  const beyond = await request("/following?page=3&limit=100");
  assert.equal(beyond.status, 200);
  assert.deepEqual(await beyond.json(), {
    data: [], pagination: { page: 3, limit: 100, total: 1, totalPages: 1 },
  });
});

test("некоректні ID та параметри пагінації повертають 400", async () => {
  for (const path of [
    "/bad-id/followers",
    "/following?page=0",
    "/following?page=1.5",
    "/following?page=1&page=2",
    "/following?page=2147483647&limit=2",
    "/following?limit=101",
    "/following?limit=",
    `/following?ownerId=${otherId}`,
  ]) {
    const response = await request(path);
    assert.equal(response.status, 400, path);
    assert.partialDeepStrictEqual(await response.json(), { success: false });
  }
});

test("неіснуючий профіль повертає 404, порожній профіль повертає 200", async () => {
  const missing = await request(`/${unknownId}/followers`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { success: false, message: "User not found" });

  const empty = await request(`/${emptyId}/followers`);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), {
    data: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
  });
});

test("PUT і DELETE ідемпотентні та змінюють обидва списки", async () => {
  const path = `/${targetId}/follow`;
  const putResponses = await Promise.all([request(path, "PUT"), request(path, "PUT")]);
  assert.deepEqual(putResponses.map((response) => response.status).sort(), [200, 201]);
  for (const response of putResponses) {
    assert.deepEqual(await response.json(), { data: { userId: targetId, isFollowing: true } });
  }

  assert.equal(await prisma.follow.count(), 1);
  const following = await request("/following");
  assert.equal(following.status, 200);
  assert.deepEqual((await readCards(following)).map(({ id }) => id), [targetId]);
  const followers = await request(`/${targetId}/followers`);
  assert.equal(followers.status, 200);
  assert.deepEqual((await readCards(followers)).map(({ id }) => id), [viewerId]);

  for (let attempt = 0; attempt < 2; attempt++) {
    const removed = await request(path, "DELETE");
    assert.equal(removed.status, 204);
    assert.equal(await removed.text(), "");
  }
  for (const listPath of ["/following", `/${targetId}/followers`]) {
    const response = await request(listPath);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
    });
  }
});

test("PUT і DELETE відхиляють власний ID, невалідний ID і неіснуючого користувача", async () => {
  for (const method of ["PUT", "DELETE"]) {
    for (const [id, status] of [[viewerId, 400], ["bad-id", 400], [unknownId, 404]] as const) {
      const response = await request(`/${id}/follow`, method);
      assert.equal(response.status, status);
      assert.partialDeepStrictEqual(await response.json(), { success: false });
    }
  }
  assert.equal(await prisma.follow.count(), 0);
});

test("профілі оновлюють лічильники та показують isFollowing для власника токена", async () => {
  const path = `/${targetId}/follow`;
  const created = await request(path, "PUT");
  assert.equal(created.status, 201);
  await created.json();

  const current = await request("/current");
  assert.equal(current.status, 200);
  assert.partialDeepStrictEqual(await current.json(), { followersCount: 0, followingCount: 1 });

  const target = await request(`/${targetId}`);
  assert.equal(target.status, 200);
  assert.partialDeepStrictEqual(await target.json(), { followersCount: 1, isFollowing: true });

  const otherViewer = await request(`/${targetId}`, "GET", generateAccessToken(otherId));
  assert.equal(otherViewer.status, 200);
  assert.partialDeepStrictEqual(await otherViewer.json(), { followersCount: 1, isFollowing: false });

  assert.equal((await request(path, "DELETE")).status, 204);
  const currentAfter = await request("/current");
  assert.equal(currentAfter.status, 200);
  assert.partialDeepStrictEqual(await currentAfter.json(), { followersCount: 0, followingCount: 0 });
  const targetAfter = await request(`/${targetId}`);
  assert.equal(targetAfter.status, 200);
  assert.partialDeepStrictEqual(await targetAfter.json(), { followersCount: 0, isFollowing: false });
});
