import prisma from "../../prisma/client.ts";
import { Prisma } from "../../generated/prisma/client.js";
import type { RecipeQuery } from "../validators/recipeValidator.js";
import type { CreateRecipeInput } from "../validators/createRecipeValidator.js";
import { generateId } from "../utils/generateId.js";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../utils/uploadToCloudinary.js";
import type { UpdateRecipeInput } from "../validators/createRecipeValidator.js";

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

const favoriteSelect = (userId = "") => ({
  where: { userId },
  select: { recipeId: true },
});

const withFavorite = <T extends { favorites: { recipeId: string }[] }>(
  recipe: T,
) => {
  const { favorites, ...fields } = recipe;
  return { ...fields, isFavorite: favorites.length > 0 };
};

const recipeDetailsSelect = {
  ...recipeCardSelect,
  instructions: true,
  ingredients: {
    orderBy: { ingredientId: "asc" },
    select: {
      measure: true,
      ingredient: { select: { id: true, name: true, img: true } },
    },
  },
} satisfies Prisma.RecipeSelect;

const formatRecipe = (
  recipe: Prisma.RecipeGetPayload<{ select: typeof recipeDetailsSelect }>,
) => ({
  ...recipe,
  ingredients: recipe.ingredients.map(({ ingredient, measure }) => ({
    ...ingredient,
    measure,
  })),
});

export const createRecipe = async (
  input: CreateRecipeInput,
  ownerId: string,
  file: Express.Multer.File,
) => {
  const [owner, category, area, ingredients] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } }),
    prisma.category.findFirst({
      where: { name: input.category },
      select: { id: true },
    }),
    prisma.area.findFirst({
      where: { name: input.area },
      select: { id: true },
    }),
    prisma.ingredient.findMany({
      where: {
        id: { in: input.ingredients.map(({ ingredientId }) => ingredientId) },
      },
      select: { id: true },
    }),
  ]);
  if (!owner) throw Object.assign(new Error("User not found"), { status: 401 });

  const errors: { field: string; message: string }[] = [];
  if (!category)
    errors.push({ field: "category", message: "Category does not exist" });
  if (!area) errors.push({ field: "area", message: "Area does not exist" });
  const ingredientIds = new Set(ingredients.map(({ id }) => id));
  input.ingredients.forEach(({ ingredientId }, index) => {
    if (!ingredientIds.has(ingredientId)) {
      errors.push({
        field: `ingredients.${index}.ingredientId`,
        message: "Ingredient does not exist",
      });
    }
  });
  if (errors.length > 0) {
    throw Object.assign(new Error("Invalid recipe data"), {
      status: 400,
      errors,
    });
  }

  let photo;
  try {
    photo = await uploadImageToCloudinary(file, { folder: "foodies/recipes" });
  } catch {
    throw Object.assign(new Error("Recipe photo upload failed"), {
      status: 502,
    });
  }

  try {
    const { ingredients: recipeIngredients, ...fields } = input;
    const recipe = await prisma.recipe.create({
      data: {
        ...fields,
        id: generateId(),
        ownerId,
        thumb: photo.url,
        photoPublicId: photo.publicId,
        ingredients: { create: recipeIngredients },
      },
      select: recipeDetailsSelect,
    });
    return { ...formatRecipe(recipe), isFavorite: false };
  } catch (error) {
    try {
      await deleteImageFromCloudinary(photo.publicId);
    } catch {
      console.error("Could not remove unused recipe photo:", photo.publicId);
    }
    throw error;
  }
};

export const getRecipes = async (
  query: RecipeQuery,
  viewerId?: string,
  favoritesOnly = false,
) => {
  const { page, limit, category, area, ingredientId, ownerId } = query;
  const where: Prisma.RecipeWhereInput = {};

  if (favoritesOnly) {
    if (!viewerId)
      throw Object.assign(new Error("Access token is required"), {
        status: 401,
      });
    where.favorites = { some: { userId: viewerId } };
  }
  if (category) where.category = category;
  if (area) where.area = area;
  if (ownerId !== undefined) where.ownerId = ownerId;
  if (ingredientId) where.ingredients = { some: { ingredientId } };

  const [data, total] = await prisma.$transaction(
    [
      prisma.recipe.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { ...recipeCardSelect, favorites: favoriteSelect(viewerId) },
      }),
      prisma.recipe.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );

  return {
    data: data.map(withFavorite),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getPopularRecipes = async (viewerId?: string) => {
  const recipes = await prisma.recipe.findMany({
    take: 4,
    orderBy: [
      { favorites: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: { ...recipeCardSelect, favorites: favoriteSelect(viewerId) },
  });
  return recipes.map(withFavorite);
};

export const deleteOwnRecipe = async (id: string, ownerId: string) => {
  let deleted;
  try {
    deleted = await prisma.recipe.delete({
      where: { id, ownerId },
      select: { photoPublicId: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      const recipe = await prisma.recipe.findUnique({
        where: { id },
        select: { id: true },
      });
      return recipe ? "forbidden" : "not_found";
    }
    throw error;
  }
  if (deleted.photoPublicId) {
    try {
      await deleteImageFromCloudinary(deleted.photoPublicId);
    } catch {
      console.error(
        "Could not remove deleted recipe photo:",
        deleted.photoPublicId,
      );
    }
  }
  return "deleted";
};

export const getRecipeById = async (id: string, viewerId?: string) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    select: { ...recipeDetailsSelect, favorites: favoriteSelect(viewerId) },
  });

  if (!recipe) return null;

  return withFavorite({ ...formatRecipe(recipe), favorites: recipe.favorites });
};

export const updateOwnRecipe = async (
  id: string,
  ownerId: string,
  input: UpdateRecipeInput,
  file?: Express.Multer.File,
) => {
  const existingRecipe = await prisma.recipe.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      photoPublicId: true,
      updatedAt: true,
    },
  });

  if (!existingRecipe) return "not_found" as const;

  if (existingRecipe.ownerId !== ownerId) {
    return "forbidden" as const;
  }

  // Validate category, area and ingredients.
  const [category, area, ingredients] = await Promise.all([
    input.category !== undefined
      ? prisma.category.findFirst({
          where: { name: input.category },
          select: { id: true },
        })
      : null,

    input.area !== undefined
      ? prisma.area.findFirst({
          where: { name: input.area },
          select: { id: true },
        })
      : null,

    input.ingredients !== undefined
      ? prisma.ingredient.findMany({
          where: {
            id: {
              in: input.ingredients.map(({ ingredientId }) => ingredientId),
            },
          },
          select: { id: true },
        })
      : null,
  ]);

  const errors: { field: string; message: string }[] = [];

  if (input.category !== undefined && !category) {
    errors.push({
      field: "category",
      message: "Category does not exist",
    });
  }

  if (input.area !== undefined && !area) {
    errors.push({
      field: "area",
      message: "Area does not exist",
    });
  }

  if (input.ingredients !== undefined && ingredients) {
    const existingIngredientIds = new Set(ingredients.map(({ id }) => id));

    input.ingredients.forEach(({ ingredientId }, index) => {
      if (!existingIngredientIds.has(ingredientId)) {
        errors.push({
          field: `ingredients.${index}.ingredientId`,
          message: "Ingredient does not exist",
        });
      }
    });
  }

  if (errors.length > 0) {
    throw Object.assign(new Error("Invalid recipe data"), {
      status: 400,
      errors,
    });
  }

  let newPhoto: { url: string; publicId: string } | undefined;

  if (file) {
    try {
      newPhoto = await uploadImageToCloudinary(file, {
        folder: "foodies/recipes",
      });
    } catch {
      throw Object.assign(new Error("Recipe photo upload failed"), {
        status: 502,
      });
    }
  }

  try {
    const { ingredients: recipeIngredients, ...fields } = input;

    const updatedRecipe = await prisma.$transaction(async (tx) => {
      // Prevent overwriting a recipe changed by another request.
      const updateResult = await tx.recipe.updateMany({
        where: {
          id,
          ownerId,
          updatedAt: existingRecipe.updatedAt,
        },
        data: {
          ...fields,
          ...(newPhoto
            ? {
                thumb: newPhoto.url,
                photoPublicId: newPhoto.publicId,
              }
            : {}),
          updatedAt: new Date(),
        },
      });

      if (updateResult.count !== 1) {
        return null;
      }

      if (recipeIngredients !== undefined) {
        await tx.recipeIngredient.deleteMany({
          where: { recipeId: id },
        });

        await tx.recipeIngredient.createMany({
          data: recipeIngredients.map(({ ingredientId, measure }) => ({
            recipeId: id,
            ingredientId,
            measure,
          })),
        });
      }

      return tx.recipe.findUnique({
        where: { id },
        select: recipeDetailsSelect,
      });
    });

    if (!updatedRecipe) {
      if (newPhoto) {
        try {
          await deleteImageFromCloudinary(newPhoto.publicId);
        } catch {
          console.error(
            "Could not remove unused recipe photo:",
            newPhoto.publicId,
          );
        }
      }

      return "conflict" as const;
    }

    // Delete the previous photo only after the database update succeeds.
    if (newPhoto && existingRecipe.photoPublicId) {
      try {
        await deleteImageFromCloudinary(existingRecipe.photoPublicId);
      } catch {
        console.error(
          "Could not remove previous recipe photo:",
          existingRecipe.photoPublicId,
        );
      }
    }

    return formatRecipe(updatedRecipe);
  } catch (error) {
    // If the database update fails, clean up the newly uploaded image.
    if (newPhoto) {
      try {
        await deleteImageFromCloudinary(newPhoto.publicId);
      } catch {
        console.error(
          "Could not remove unused recipe photo:",
          newPhoto.publicId,
        );
      }
    }

    throw error;
  }
};
