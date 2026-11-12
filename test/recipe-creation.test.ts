import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import type { Server } from "node:http";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, mock, test } from "node:test";
import pg from "pg";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import SwaggerParser from "@apidevtools/swagger-parser";

if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to run PostgreSQL integration tests");
const databaseName = `foodies_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const admin = new pg.Client({ connectionString: databaseUrl.href });
databaseUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = databaseUrl.href;
process.env.JWT_SECRET = randomUUID();

let databaseCreated = false;
let prisma: typeof import("../prisma/client.ts").default;
let server: Server | undefined;
let baseUrl: string;
let accessToken: string;
let ownerId: string;
let otherToken: string;
let otherId: string;
let uploadFailure = false;
let deleteFailure = false;
let afterUpload: (() => Promise<void>) | undefined;
const uploads: { publicId: string; bytes: Buffer; folder: string }[] = [];
const deletions: string[] = [];
const ingredientId = "20000000000000000000000a";
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=", "base64");

before(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  const migration = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "deploy",
  ], { env: process.env, encoding: "utf8", timeout: 30000 });
  assert.equal(migration.status, 0, migration.stdout + migration.stderr);
  prisma = (await import("../prisma/client.ts")).default;
  await prisma.category.create({ data: { id: "300000000000000000000001", name: "Seafood" } });
  await prisma.area.create({ data: { id: "400000000000000000000001", name: "Greek" } });
  await prisma.ingredient.create({ data: { id: ingredientId, name: "Salmon" } });

  mock.method(cloudinary.uploader, "upload_stream", (options: { folder: string }, callback: (error?: Error, result?: { public_id: string; secure_url: string }) => void) => {
    const chunks: Buffer[] = [];
    return new Writable({
      write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); },
      final(done) {
        const publicId = `foodies/recipes/${randomUUID()}`;
        if (uploadFailure) {
          callback(new Error("Upload unavailable"));
          done();
          return;
        }
        uploads.push({ publicId, bytes: Buffer.concat(chunks), folder: options.folder });
        Promise.resolve(afterUpload?.()).then(() => {
          callback(undefined, { public_id: publicId, secure_url: `https://example.com/${publicId}.png` });
          done();
        }).catch(done);
      },
    });
  });
  mock.method(cloudinary.uploader, "destroy", async (publicId: string) => {
    deletions.push(publicId);
    if (deleteFailure) throw new Error("Delete unavailable");
    return { result: "ok" };
  });

  const app = (await import("../src/app.ts")).default;
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
  const register = async (email: string) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Recipe author", email, password: "TestPassword123!" }),
    });
    assert.equal(response.status, 201);
    return await response.json() as { user: { id: string }; accessToken: string };
  };
  const author = await register("author@example.com");
  ownerId = author.user.id;
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "author@example.com", password: "TestPassword123!" }),
  });
  assert.equal(login.status, 200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
  const other = await register("other@example.com");
  otherToken = other.accessToken;
  otherId = other.user.id;
}, { timeout: 45000 });

beforeEach(async () => {
  await prisma.recipe.deleteMany();
  uploads.length = 0;
  deletions.length = 0;
  uploadFailure = false;
  deleteFailure = false;
  afterUpload = undefined;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  mock.restoreAll();
  if (prisma) await prisma.$disconnect();
  try {
    if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}"`);
  } finally { await admin.end(); }
});

const form = (changes: Record<string, string> = {}, photo: Blob | null = new Blob([image], { type: "image/png" })) => {
  const data = new FormData();
  const fields = {
    title: " Salmon salad ", description: "Salmon with vegetables", category: "Seafood", area: "Greek",
    time: "30", instructions: "Cook the salmon.", ingredients: JSON.stringify([{ ingredientId, measure: " 100 g " }]),
    ...changes,
  };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  if (photo) data.append("photo", photo, "recipe.png");
  return data;
};
const create = (body = form(), token: string | null = accessToken) => fetch(`${baseUrl}/api/recipes`, {
  method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body,
});
const remove = (id: string, token = accessToken) => fetch(`${baseUrl}/api/recipes/${id}`, {
  method: "DELETE", headers: { Authorization: `Bearer ${token}` },
});

test("вхід, створення, свої рецепти та видалення працюють разом", async () => {
  const response = await create();
  assert.equal(response.status, 201);
  const { data } = await response.json() as { data: { id: string; title: string; owner: { id: string }; ingredients: unknown[] } };
  assert.match(data.id, /^[a-f\d]{24}$/);
  assert.equal(data.title, "Salmon salad");
  assert.equal(data.owner.id, ownerId);
  assert.deepEqual(data.ingredients, [{ id: ingredientId, name: "Salmon", img: null, measure: "100 g" }]);
  assert.ok(!("photoPublicId" in data));
  assert.equal(uploads[0].folder, "foodies/recipes");
  assert.deepEqual(uploads[0].bytes, image);
  const stored = await prisma.recipe.findUniqueOrThrow({ where: { id: data.id } });
  assert.equal(stored.photoPublicId, uploads[0].publicId);
  const details = await fetch(`${baseUrl}/api/recipes/${data.id}`);
  assert.deepEqual(await details.json(), { data });
  const own = await fetch(`${baseUrl}/api/recipes/own`, { headers: { Authorization: `Bearer ${accessToken}` } });
  assert.equal((await own.json() as { pagination: { total: number } }).pagination.total, 1);
  await prisma.favorite.create({ data: { userId: otherId, recipeId: data.id } });
  assert.equal((await remove(data.id, otherToken)).status, 403);
  assert.equal(deletions.length, 0);
  const deleted = await remove(data.id);
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), "");
  assert.deepEqual(deletions, [uploads[0].publicId]);
  assert.equal(await prisma.recipeIngredient.count(), 0);
  assert.equal(await prisma.favorite.count(), 0);
  assert.equal((await remove(data.id)).status, 404);
  const profile = await fetch(`${baseUrl}/api/users/current`, { headers: { Authorization: `Bearer ${accessToken}` } });
  assert.equal((await profile.json() as { recipesCount: number }).recipesCount, 0);
});

test("гість, прострочений токен і refresh не можуть створити рецепт", async () => {
  for (const token of [null, "invalid", jwt.sign({ sub: ownerId, type: "access" }, process.env.JWT_SECRET!, { expiresIn: -1 }),
    jwt.sign({ sub: ownerId, type: "refresh" }, process.env.JWT_SECRET!)]) {
    assert.equal((await create(form(), token)).status, 401);
  }
  assert.equal(uploads.length, 0);
  assert.equal(await prisma.recipe.count(), 0);
});

test("створення приймає лише multipart/form-data", async () => {
  const response = await fetch(`${baseUrl}/api/recipes`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(response.status, 415);
  assert.equal(uploads.length, 0);
});

test("токен видаленого користувача не завантажує фото", async () => {
  const token = jwt.sign({ sub: "f".repeat(24), type: "access" }, process.env.JWT_SECRET!);
  assert.equal((await create(form(), token)).status, 401);
  assert.equal(uploads.length, 0);
});

test("зміни завантаження фото зберігають роботу аватара", async () => {
  const body = new FormData();
  body.append("avatar", new Blob([image], { type: "image/png" }), "avatar.png");
  const response = await fetch(`${baseUrl}/api/users/current/avatar`, {
    method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` }, body,
  });
  assert.equal(response.status, 200);
  const result = await response.json() as { user: { avatar: string } };
  assert.equal(typeof result.user.avatar, "string");
  assert.equal(uploads[0].folder, "foodies/avatars");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).avatar, result.user.avatar);
});

test("валідація форми відхиляє неправильні поля до завантаження фото", async (context) => {
  const cases: [Record<string, string>, string][] = [
    [{ title: " " }, "title"], [{ title: "a".repeat(256) }, "title"],
    [{ description: "a".repeat(201) }, "description"], [{ instructions: "a".repeat(1001) }, "instructions"],
    [{ time: "0" }, "time"], [{ time: "1.5" }, "time"], [{ time: "1e2" }, "time"], [{ time: "2147483648" }, "time"],
    [{ ingredients: "bad json" }, "ingredients"], [{ ingredients: "{}" }, "ingredients"], [{ ingredients: "[]" }, "ingredients"],
    [{ ingredients: JSON.stringify([{ ingredientId: "bad", measure: "100 g" }]) }, "ingredients.0.ingredientId"],
    [{ ingredients: JSON.stringify([{ ingredientId, measure: " " }]) }, "ingredients.0.measure"],
    [{ ingredients: JSON.stringify([{ ingredientId, measure: "x".repeat(101) }]) }, "ingredients.0.measure"],
    [{ ingredients: JSON.stringify([{ ingredientId, measure: "100 g", name: "Salmon" }]) }, "ingredients.0.name"],
    [{ ingredients: JSON.stringify([{ ingredientId, measure: "1 g" }, { ingredientId: ingredientId.toUpperCase(), measure: "2 g" }]) }, "ingredients.1.ingredientId"],
    [{ ownerId: otherId }, "ownerId"], [{ category: "Missing" }, "category"], [{ area: "Missing" }, "area"],
    [{ ingredients: JSON.stringify([{ ingredientId: "f".repeat(24), measure: "1 g" }]) }, "ingredients.0.ingredientId"],
  ];
  for (const [changes, field] of cases) {
    await context.test(JSON.stringify(changes).slice(0, 75), async () => {
      const response = await create(form(changes));
      assert.equal(response.status, 400);
      const body = await response.json() as { errors: { field: string }[] };
      assert.ok(body.errors.some((error) => error.field === field));
    });
  }
  const repeated = form();
  repeated.append("title", "Another title");
  assert.equal((await create(repeated)).status, 400);
  assert.equal(uploads.length, 0);
  assert.equal(await prisma.recipe.count(), 0);
});

test("фото обов'язкове, має правильний формат, розмір і назву поля", async () => {
  for (const photo of [null, new Blob([], { type: "image/png" }), new Blob(["fake"], { type: "image/png" }), new Blob([image], { type: "text/plain" })]) {
    assert.equal((await create(form({}, photo))).status, 400);
  }
  const oversized = new Blob([image, new Uint8Array(5 * 1024 * 1024)], { type: "image/png" });
  assert.equal((await create(form({}, oversized))).status, 413);
  const wrongField = form({}, null);
  wrongField.append("avatar", new Blob([image], { type: "image/png" }), "recipe.png");
  assert.equal((await create(wrongField)).status, 400);
  const repeated = form();
  repeated.append("photo", new Blob([image], { type: "image/png" }), "another.png");
  assert.equal((await create(repeated)).status, 400);
  const malformed = await fetch(`${baseUrl}/api/recipes`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "multipart/form-data" }, body: "bad form",
  });
  assert.equal(malformed.status, 400);
  assert.equal(uploads.length, 0);
});

test("помилка Cloudinary не створює рецепт", async () => {
  uploadFailure = true;
  const response = await create();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { success: false, message: "Internal Server Error" });
  assert.equal(await prisma.recipe.count(), 0);
});

test("помилка запису інгредієнтів відкочує рецепт і прибирає завантажене фото", async () => {
  afterUpload = async () => { await prisma.ingredient.delete({ where: { id: ingredientId } }); };
  try {
    const response = await create();
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false, message: "Internal Server Error" });
    assert.equal(await prisma.recipe.count(), 0);
    assert.equal(await prisma.recipeIngredient.count(), 0);
    assert.deepEqual(deletions, [uploads[0].publicId]);
  } finally {
    await prisma.ingredient.create({ data: { id: ingredientId, name: "Salmon" } });
  }
});

test("зовнішнє фото початкового рецепта не видаляється з Cloudinary", async () => {
  const id = "500000000000000000000001";
  await prisma.recipe.create({ data: {
    id, title: "Seed recipe", description: "Initial data", instructions: "Cook", thumb: "https://example.com/seed.jpg",
    category: "Seafood", area: "Greek", time: 10, ownerId,
  } });
  assert.equal((await remove(id)).status, 204);
  assert.equal(deletions.length, 0);
});

test("одночасні запити видаляють рецепт і фото лише один раз", async () => {
  const response = await create();
  const { data } = await response.json() as { data: { id: string } };
  const results = await Promise.all([remove(data.id), remove(data.id)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [204, 404]);
  assert.deepEqual(deletions, [uploads[0].publicId]);
});

test("збій видалення фото не повертає помилку для вже видаленого рецепта", async () => {
  const response = await create();
  const { data } = await response.json() as { data: { id: string } };
  deleteFailure = true;
  const log = mock.method(console, "error", () => {});
  try {
    assert.equal((await remove(data.id)).status, 204);
    assert.equal(await prisma.recipe.count(), 0);
    assert.equal(log.mock.calls.length, 1);
    assert.equal(log.mock.calls[0].arguments[1], uploads[0].publicId);
  } finally { log.mock.restore(); }
});

test("Swagger проходить перевірку OpenAPI і доступний через HTTP", async () => {
  const schema = await SwaggerParser.validate(fileURLToPath(new URL("../docs/openapi.json", import.meta.url)));
  assert.equal(schema.info.title, "Foodies Recipes API");
  assert.equal((await fetch(`${baseUrl}/api-docs/`)).status, 200);
  const response = await fetch(`${baseUrl}/api-docs/openapi.json`);
  assert.equal(response.status, 200);
  const spec = await response.json() as { paths: Record<string, unknown> };
  assert.ok(spec.paths["/api/recipes"]);
  assert.ok(spec.paths["/api/recipes/own"]);
  assert.ok(spec.paths["/api/recipes/{id}"]);
});
