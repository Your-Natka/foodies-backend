import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import pg from "pg";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL to run PostgreSQL integration tests");
}

const databaseName = `foodies_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const admin = new pg.Client({ connectionString: databaseUrl.href });
databaseUrl.pathname = `/${databaseName}`;
const database = new pg.Client({ connectionString: databaseUrl.href });
let databaseCreated = false;

const firstUser = "100000000000000000000001";
const secondUser = "100000000000000000000002";
const firstRecipe = "200000000000000000000001";
const secondRecipe = "200000000000000000000002";
const missingRecipe = "200000000000000000000099";

before(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  await database.connect();

  const initial = await readFile(new URL("../prisma/migrations/20261110165903_init/migration.sql", import.meta.url), "utf8");
  await database.query(initial);
  const users: [string, string[] | null][] = [
    [firstUser, [firstRecipe, firstRecipe, secondRecipe, missingRecipe]],
    [secondUser, [firstRecipe]],
    ["100000000000000000000003", []],
    ["100000000000000000000004", null],
  ];
  for (const [id, favorites] of users) {
    await database.query(`
      INSERT INTO users (id, name, email, password, favorite_recipe_ids, updated_at)
      VALUES ($1, 'Test user', $2, 'private-password', $3, CURRENT_TIMESTAMP)
    `, [id, `${id}@example.com`, favorites]);
  }
  for (const id of [firstRecipe, secondRecipe]) {
    await database.query(`
      INSERT INTO recipes (id, title, category, area, instructions, description, thumb, time, owner_id, updated_at)
      VALUES ($1, 'Recipe', 'Seafood', 'Greek', 'Cook', 'Description', 'https://example.com/recipe.jpg', 30, $2, CURRENT_TIMESTAMP)
    `, [id, firstUser]);
  }

  const migration = await readFile(new URL("../prisma/migrations/20261111214554_add_favorites/migration.sql", import.meta.url), "utf8");
  await database.query(migration);
});

after(async () => {
  await database.end();
  try {
    if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }
});

test("міграція переносить обране без дублів і посилань на відсутні рецепти", async () => {
  const result = await database.query("SELECT user_id, recipe_id FROM favorites ORDER BY user_id, recipe_id");
  assert.deepEqual(result.rows, [
    { user_id: firstUser, recipe_id: firstRecipe },
    { user_id: firstUser, recipe_id: secondRecipe },
    { user_id: secondUser, recipe_id: firstRecipe },
  ]);
  const users = await database.query("SELECT COUNT(*)::int AS count FROM users");
  assert.equal(users.rows[0].count, 4);
  const column = await database.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'favorite_recipe_ids'
  `);
  assert.equal(column.rowCount, 0);
});

test("пара користувач/рецепт не може повторюватися", async () => {
  await assert.rejects(
    database.query("INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)", [firstUser, firstRecipe]),
    { code: "23505" },
  );
});

test("обране не може посилатися на відсутнього користувача або рецепт", async () => {
  for (const pair of [[firstUser, missingRecipe], ["100000000000000000000099", firstRecipe]]) {
    await assert.rejects(
      database.query("INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)", pair),
      { code: "23503" },
    );
  }
});

test("видалення користувача або рецепта прибирає тільки відповідні зв'язки", async () => {
  await database.query("DELETE FROM users WHERE id = $1", [secondUser]);
  let result = await database.query("SELECT user_id, recipe_id FROM favorites ORDER BY recipe_id");
  assert.deepEqual(result.rows, [
    { user_id: firstUser, recipe_id: firstRecipe },
    { user_id: firstUser, recipe_id: secondRecipe },
  ]);

  await database.query("DELETE FROM recipes WHERE id = $1", [secondRecipe]);
  result = await database.query("SELECT user_id, recipe_id FROM favorites");
  assert.deepEqual(result.rows, [{ user_id: firstUser, recipe_id: firstRecipe }]);
});
