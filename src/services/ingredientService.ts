import prisma from "../../prisma/client.ts";

export const getAllIngredients = async () => {
  return prisma.ingredient.findMany({
    select: { id: true, name: true, img: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
};
