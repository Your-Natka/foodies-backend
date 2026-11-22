import prisma from "../../prisma/client.ts";

const isImageAvailable = async (url: string | null) => {
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });

    return response.ok;
  } catch {
    return false;
  }
};

export const getAllIngredients = async () => {
  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, name: true, img: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return Promise.all(
    ingredients.map(async (ingredient) => ({
      ...ingredient,
      img: (await isImageAvailable(ingredient.img)) ? ingredient.img : null,
    })),
  );
};
