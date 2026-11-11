import prisma from "../../prisma/client.ts";
import type { Prisma } from "../../generated/prisma/client.js";
import type { RecipeQuery } from "../validators/recipeValidator.js";

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
      select: {
        id: true,
        title: true,
        description: true,
        thumb: true,
        category: true,
        area: true,
        time: true,
        createdAt: true,
        owner: { select: { id: true, name: true, avatar: true } },
      },
    }),
    prisma.recipe.count({ where }),
  ], { isolationLevel: "RepeatableRead" });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
