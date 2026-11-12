import type { Request, Response } from "express";
import {
  deleteOwnRecipe,
  getPopularRecipes,
  getRecipeById,
  getRecipes,
} from "../services/recipeService.js";
import { parseRecipeId, parseRecipeQuery } from "../validators/recipeValidator.js";

export const listRecipes = async (req: Request, res: Response) => {
  const { query, errors } = parseRecipeQuery(req.query);

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors,
    });
    return;
  }

  const result = await getRecipes(query);
  res.status(200).json(result);
};

export const listOwnRecipes = async (req: Request, res: Response) => {
  const { query, errors } = parseRecipeQuery(req.query, ["page", "limit"]);

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: "Invalid query parameters", errors });
    return;
  }

  const result = await getRecipes({ ...query, ownerId: req.user!.sub });
  res.set("Cache-Control", "private, no-store");
  res.status(200).json(result);
};

export const removeRecipe = async (req: Request, res: Response) => {
  const id = parseRecipeId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Invalid recipe ID" });
    return;
  }

  const result = await deleteOwnRecipe(id, req.user!.sub);
  if (result === "not_found") {
    res.status(404).json({ success: false, message: "Recipe not found" });
    return;
  }
  if (result === "forbidden") {
    res.status(403).json({ success: false, message: "You can only delete your own recipes" });
    return;
  }

  res.status(204).end();
};

export const getRecipe = async (req: Request, res: Response) => {
  const id = parseRecipeId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Invalid recipe ID" });
    return;
  }

  const recipe = await getRecipeById(id);
  if (!recipe) {
    res.status(404).json({ success: false, message: "Recipe not found" });
    return;
  }

  res.status(200).json({ data: recipe });
};

export const listPopularRecipes = async (req: Request, res: Response) => {
  const fields = Object.keys(req.query);
  if (fields.length > 0) {
    res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: fields.map((field) => ({ field, message: "Unknown query parameter" })),
    });
    return;
  }

  const data = await getPopularRecipes();
  res.status(200).json({ data });
};
