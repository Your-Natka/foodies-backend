import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import pg from "pg";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL to run PostgreSQL integration tests");
}

const databaseName = `foodies_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const admin = new pg.Client({ connectionString: databaseUrl.href });
databaseUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = databaseUrl.href;
process.env.ALLOWED_ORIGINS = "http://localhost:5173";

let databaseCreated = false;
let prisma: typeof import("../prisma/client.ts").default;
let server: Server | undefined;
let baseUrl: string;

const firstOwner = "10000000000000000000000a";
const secondOwner = "10000000000000000000000b";
const salmon = "20000000000000000000000a";
const salt = "20000000000000000000000b";
const recipeId = (number: number) => number.toString(16).padStart(24, "0");
const favorites = [
  ...[1, 2, 3, 13].map((number) => ({ userId: firstOwner, recipeId: recipeId(number) })),
  ...[1, 13].map((number) => ({ userId: secondOwner, recipeId: recipeId(number) })),
];
const longDescription = "Опис початкового рецепта. ".repeat(20);
const longInstructions = "Cook the ingredients. ".repeat(60);

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
  await prisma.user.createMany({ data: [
    { id: firstOwner, name: "Olena", email: "olena@example.com", password: "private-password" },
    { id: secondOwner, name: "Taras", email: "taras@example.com", password: "private-password" },
  ] });
  await prisma.ingredient.createMany({ data: [
    { id: salmon, name: "Salmon", img: "https://example.com/salmon.png" },
    { id: salt, name: null, img: null },
  ] });

  for (let number = 1; number <= 13; number++) {
    await prisma.recipe.create({ data: {
      id: recipeId(number),
      title: `Recipe ${number}`,
      description: number === 13 ? longDescription : `Description ${number}`,
      instructions: longInstructions,
      thumb: "https://example.com/recipe.jpg",
      category: number <= 6 ? "Seafood" : "Dessert",
      area: number % 2 === 0 ? "Japanese" : "Greek",
      time: 30,
      ownerId: number <= 8 ? firstOwner : secondOwner,
      createdAt: new Date(number === 13 ? "2026-01-03T00:00:00Z" : "2026-01-02T00:00:00Z"),
      ingredients: { create: number === 12 ? [] : [{
        ingredientId: number <= 4 ? salmon : salt,
        measure: "100 g",
      }] },
    } });
  }

  await prisma.recipeIngredient.create({ data: {
    recipeId: recipeId(1), ingredientId: salt, measure: "1 pinch",
  } });
  await prisma.favorite.createMany({ data: favorites });

  const app = (await import("../src/app.ts")).default;
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
}, { timeout: 45000 });

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
  }
  if (prisma) await prisma.$disconnect();
  try {
    if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }
});

interface CatalogResponse {
  data: { id: string; description: string; owner: Record<string, unknown> }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const catalog = async (query = "") => {
  const response = await fetch(`${baseUrl}/api/recipes${query}`);
  assert.equal(response.status, 200);
  return await response.json() as CatalogResponse;
};

const popularRecipes = async () => {
  const response = await fetch(`${baseUrl}/api/recipes/popular`);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: CatalogResponse["data"] };
  assert.deepEqual(Object.keys(body), ["data"]);
  return body.data;
};

test("каталог доступний гостю та містить тільки публічні дані автора", async () => {
  const body = await catalog();
  assert.equal(body.data.length, 9);
  assert.deepEqual(body.pagination, { page: 1, limit: 9, total: 13, totalPages: 2 });
  assert.equal(body.data[0].id, recipeId(13));
  assert.equal(body.data[0].description, longDescription);
  for (const recipe of body.data) {
    assert.deepEqual(Object.keys(recipe.owner).sort(), ["avatar", "id", "name"]);
  }
  assert.deepEqual(body.data[0].owner, { id: secondOwner, name: "Taras", avatar: null });
});

test("пагінація з однаковими датами не повторює і не пропускає рецепти", async () => {
  const ids: string[] = [];
  for (const page of [1, 2, 3]) {
    const body = await catalog(`?page=${page}&limit=5`);
    ids.push(...body.data.map((recipe) => recipe.id));
    assert.deepEqual(body.pagination, { page, limit: 5, total: 13, totalPages: 3 });
  }
  assert.deepEqual(ids, Array.from({ length: 13 }, (_, index) => recipeId(13 - index)));
});

test("кожен фільтр обмежує результати та total", async (context) => {
  const cases: [string, number[]][] = [
    ["category=Seafood", [6, 5, 4, 3, 2, 1]],
    ["area=Japanese", [12, 10, 8, 6, 4, 2]],
    [`ingredientId=${salmon}`, [4, 3, 2, 1]],
    [`ownerId=${secondOwner}`, [13, 12, 11, 10, 9]],
    [`ingredientId=${salmon.toUpperCase()}`, [4, 3, 2, 1]],
  ];
  for (const [query, expected] of cases) {
    await context.test(query, async () => {
      const body = await catalog(`?${query}`);
      assert.deepEqual(body.data.map((recipe) => recipe.id), expected.map(recipeId));
      assert.equal(body.pagination.total, expected.length);
    });
  }
});

test("усі фільтри застосовуються разом до списку і total", async () => {
  const body = await catalog(`?category=Seafood&area=Japanese&ingredientId=${salmon}&ownerId=${firstOwner}&page=2&limit=1`);
  assert.deepEqual(body.data.map((recipe) => recipe.id), [recipeId(2)]);
  assert.deepEqual(body.pagination, { page: 2, limit: 1, total: 2, totalPages: 2 });
});

test("порожні фільтри ігноруються, пробіли навколо назви прибираються", async () => {
  const empty = await catalog("?category=%20&area=&ingredientId=&ownerId=");
  assert.equal(empty.pagination.total, 13);
  const trimmed = await catalog("?category=%20Seafood%20");
  assert.equal(trimmed.pagination.total, 6);
});

test("відсутні результати та сторінка за межами списку повертають 200", async () => {
  const empty = await catalog("?category=Missing");
  assert.deepEqual(empty, { data: [], pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } });
  const missingIngredient = await catalog("?ingredientId=ffffffffffffffffffffffff");
  assert.equal(missingIngredient.pagination.total, 0);
  const outside = await catalog("?category=Seafood&page=3&limit=5");
  assert.deepEqual(outside, { data: [], pagination: { page: 3, limit: 5, total: 6, totalPages: 2 } });
});

test("limit=100 дозволений", async () => {
  const body = await catalog("?limit=100");
  assert.equal(body.data.length, 13);
  assert.equal(body.pagination.limit, 100);
});

test("невалідні параметри повертають 400 із назвою поля", async (context) => {
  const cases: [string, string][] = [
    ["page=0", "page"], ["page=-1", "page"], ["page=1.5", "page"],
    ["page=abc", "page"], ["page=", "page"], ["page=1e2", "page"],
    ["page=99999999999999999999", "page"], ["page=2147483647&limit=100", "page"],
    ["limit=0", "limit"], ["limit=101", "limit"], ["limit=2&limit=3", "limit"],
    ["category=A&category=B", "category"], ["category[x]=A", "category[x]"],
    [`category=${"a".repeat(101)}`, "category"], [`area=${"a".repeat(101)}`, "area"],
    ["ingredientId=bad-id", "ingredientId"], ["ownerId=bad-id", "ownerId"],
    ["perPage=10", "perPage"],
  ];
  for (const [query, field] of cases) {
    await context.test(query.slice(0, 50), async () => {
      const response = await fetch(`${baseUrl}/api/recipes?${query}`);
      assert.equal(response.status, 400);
      const body = await response.json() as { success: boolean; errors: { field: string }[] };
      assert.equal(body.success, false);
      assert.ok(body.errors.some((error) => error.field === field));
    });
  }
});

test("дозволений frontend отримує CORS для запитів із credentials", async () => {
  const response = await fetch(`${baseUrl}/api/recipes`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  const denied = await fetch(`${baseUrl}/api/recipes`, {
    headers: { Origin: "https://other.example" },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});

test("помилка JSON повертає 400", async () => {
  const response = await fetch(`${baseUrl}/api/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, message: "Invalid JSON body" });
});

test("деталі рецепта доступні гостю, містять інгредієнти та публічні дані автора", async () => {
  const response = await fetch(`${baseUrl}/api/recipes/${recipeId(1)}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      id: recipeId(1),
      title: "Recipe 1",
      description: "Description 1",
      instructions: longInstructions,
      thumb: "https://example.com/recipe.jpg",
      category: "Seafood",
      area: "Greek",
      time: 30,
      createdAt: "2026-01-02T00:00:00.000Z",
      owner: { id: firstOwner, name: "Olena", avatar: null },
      ingredients: [
        { id: salmon, name: "Salmon", img: "https://example.com/salmon.png", measure: "100 g" },
        { id: salt, name: null, img: null, measure: "1 pinch" },
      ],
    },
  });
});

test("деталі зберігають довгі описи та інструкції початкових рецептів", async () => {
  const response = await fetch(`${baseUrl}/api/recipes/${recipeId(13)}`);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { description: string; instructions: string } };
  assert.equal(body.data.description, longDescription);
  assert.equal(body.data.instructions, longInstructions);
});

test("рецепт без інгредієнтів повертає порожній масив", async () => {
  const response = await fetch(`${baseUrl}/api/recipes/${recipeId(12)}`);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { ingredients: unknown[] } };
  assert.deepEqual(body.data.ingredients, []);
});

test("великі літери в ID рецепта приймаються", async () => {
  const response = await fetch(`${baseUrl}/api/recipes/${recipeId(10).toUpperCase()}`);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { id: string } };
  assert.equal(body.data.id, recipeId(10));
});

test("відсутній рецепт повертає 404", async () => {
  const response = await fetch(`${baseUrl}/api/recipes/ffffffffffffffffffffffff`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, message: "Recipe not found" });
});

test("неправильний формат ID рецепта повертає 400", async (context) => {
  const ids = [
    "bad-id", "a".repeat(23), "a".repeat(25), "g".repeat(24),
    `%20${recipeId(1)}`, `${recipeId(1)}%20`,
  ];
  for (const id of ids) {
    await context.test(id, async () => {
      const response = await fetch(`${baseUrl}/api/recipes/${id}`);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { success: false, message: "Invalid recipe ID" });
    });
  }
});

test("популярні рецепти доступні гостю та рахують різних користувачів", async () => {
  const recipes = await popularRecipes();
  assert.deepEqual(recipes.map(({ id }) => id), [13, 1, 3, 2].map(recipeId));
  for (const recipe of recipes) {
    assert.deepEqual(Object.keys(recipe).sort(), [
      "area", "category", "createdAt", "description", "id", "owner", "thumb", "time", "title",
    ]);
    assert.deepEqual(Object.keys(recipe.owner).sort(), ["avatar", "id", "name"]);
  }
  assert.equal(recipes[0].description, longDescription);
});

test("зміна обраного змінює порядок популярних рецептів", async () => {
  try {
    await prisma.favorite.delete({ where: {
      userId_recipeId: { userId: secondOwner, recipeId: recipeId(13) },
    } });
    const recipes = await popularRecipes();
    assert.deepEqual(recipes.map(({ id }) => id), [1, 13, 3, 2].map(recipeId));
  } finally {
    await prisma.favorite.create({ data: { userId: secondOwner, recipeId: recipeId(13) } });
  }
});

test("без збережень популярні рецепти впорядковані за датою та ID", async () => {
  try {
    await prisma.favorite.deleteMany();
    const recipes = await popularRecipes();
    assert.deepEqual(recipes.map(({ id }) => id), [13, 12, 11, 10].map(recipeId));
  } finally {
    await prisma.favorite.createMany({ data: favorites });
  }
});

test("популярні рецепти не приймають пагінацію та фільтри", async () => {
  const response = await fetch(`${baseUrl}/api/recipes/popular?page=2&limit=1&category=Seafood`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Invalid query parameters",
    errors: ["page", "limit", "category"].map((field) => ({ field, message: "Unknown query parameter" })),
  });
});

test("помилка читання не розкриває подробиці БД", async () => {
  await prisma.$executeRaw`ALTER TABLE "recipes" RENAME TO "recipes_unavailable"`;
  try {
    for (const path of ["/api/recipes", "/api/recipes/popular", `/api/recipes/${recipeId(1)}`]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { success: false, message: "Internal Server Error" });
    }
    const invalid = await fetch(`${baseUrl}/api/recipes/bad-id`);
    assert.equal(invalid.status, 400);
  } finally {
    await prisma.$executeRaw`ALTER TABLE "recipes_unavailable" RENAME TO "recipes"`;
  }
});

test("видалені рецепти не потрапляють у популярні, порожній каталог повертає порожній список", async () => {
  await prisma.recipe.deleteMany({ where: { id: { notIn: [recipeId(1), recipeId(2)] } } });
  const recipes = await popularRecipes();
  assert.deepEqual(recipes.map(({ id }) => id), [1, 2].map(recipeId));

  await prisma.recipe.deleteMany();
  assert.deepEqual(await popularRecipes(), []);
});
