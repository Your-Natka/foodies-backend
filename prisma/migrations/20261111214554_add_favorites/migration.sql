BEGIN;

-- Не допускаємо зміни старого масиву під час перенесення.
LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE "favorites" (
    "user_id" VARCHAR(24) NOT NULL,
    "recipe_id" VARCHAR(24) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id", "recipe_id"),
    CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "favorites_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "favorites_recipe_id_idx" ON "favorites"("recipe_id");

-- Переносимо наявні рецепти без повторів у межах одного користувача.
INSERT INTO "favorites" ("user_id", "recipe_id")
SELECT DISTINCT u.id, r.id
FROM "users" AS u
CROSS JOIN LATERAL unnest(u.favorite_recipe_ids) AS saved(recipe_id)
JOIN "recipes" AS r ON r.id = saved.recipe_id;

ALTER TABLE "users" DROP COLUMN "favorite_recipe_ids";

COMMIT;
