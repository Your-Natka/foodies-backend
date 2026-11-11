import prisma from "../../prisma/client.ts";
import type { Prisma } from "../../generated/prisma/client.js";
import type { RecipeQuery } from "../validators/recipeValidator.js";

const recipeCardSelect = {
  id: true,
  title: true,
  description: true,
  thumb: true,
  category: true,
  area: true,
  time: true,
  createdAt: true,
  owner: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.RecipeSelect;

export const getRecipes = async (query: RecipeQuery) => {
  const { page, limit, category, area, ingredientId, ownerId } = query;
  const where: Prisma.RecipeWhereInput = {};

  if (category) where.category = category;
  if (area) where.area = area;
  if (ownerId) where.ownerId = ownerId;
  if (ingredientId) where.ingredients = { some: { ingredientId } };

  const [data, total] = await prisma.$transaction([
    prisma.recipe.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: recipeCardSelect,
    }),
    prisma.recipe.count({ where }),
  ], { isolationLevel: "RepeatableRead" });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getPopularRecipes = async () => {
  return prisma.recipe.findMany({
    take: 4,
    orderBy: [{ favorites: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }],
    select: recipeCardSelect,
  });
};

export const getRecipeById = async (id: string) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    select: {
      ...recipeCardSelect,
      instructions: true,
      ingredients: {
        orderBy: { ingredientId: "asc" },
        select: {
          measure: true,
          ingredient: { select: { id: true, name: true, img: true } },
        },
      },
    },
  });

  if (!recipe) return null;

  return {
    ...recipe,
    ingredients: recipe.ingredients.map(({ ingredient, measure }) => ({
      ...ingredient,
      measure,
    })),
  };
};
