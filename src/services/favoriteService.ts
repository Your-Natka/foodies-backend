import prisma from "../../prisma/client.js";
import { Prisma } from "../../generated/prisma/client.js";

export const requireFavoriteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw Object.assign(new Error("User not found"), { status: 401 });
};

export const addFavorite = async (userId: string, recipeId: string) => {
  await requireFavoriteUser(userId);
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) throw Object.assign(new Error("Recipe not found"), { status: 404 });
  try {
    const result = await prisma.favorite.createMany({ data: [{ userId, recipeId }], skipDuplicates: true });
    return result.count > 0;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      await requireFavoriteUser(userId);
      throw Object.assign(new Error("Recipe not found"), { status: 404 });
    }
    throw error;
  }
};

export const removeFavorite = async (userId: string, recipeId: string) => {
  await requireFavoriteUser(userId);
  await prisma.favorite.deleteMany({ where: { userId, recipeId } });
};
