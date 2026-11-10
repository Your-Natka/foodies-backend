-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(24) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "refresh_token_hash" TEXT,
    "session_expires_at" TIMESTAMP(3),
    "favorite_recipe_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "following" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" VARCHAR(24) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" VARCHAR(24) NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" VARCHAR(24) NOT NULL,
    "name" VARCHAR(255),
    "description" TEXT,
    "img" TEXT,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" VARCHAR(24) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "area" VARCHAR(100) NOT NULL,
    "instructions" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumb" TEXT NOT NULL,
    "preview" TEXT,
    "time" INTEGER NOT NULL,
    "owner_id" VARCHAR(24) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "recipe_id" VARCHAR(24) NOT NULL,
    "ingredient_id" VARCHAR(24) NOT NULL,
    "measure" VARCHAR(100) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("recipe_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" VARCHAR(24) NOT NULL,
    "owner_id" VARCHAR(24) NOT NULL,
    "testimonial" TEXT NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "recipes_owner_id_idx" ON "recipes"("owner_id");

-- CreateIndex
CREATE INDEX "recipes_category_idx" ON "recipes"("category");

-- CreateIndex
CREATE INDEX "recipes_area_idx" ON "recipes"("area");

-- CreateIndex
CREATE INDEX "recipes_created_at_idx" ON "recipes"("created_at");

-- CreateIndex
CREATE INDEX "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients"("ingredient_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
