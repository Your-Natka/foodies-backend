import type { Request, Response } from "express";
import { getRecipeById, getRecipes } from "../sevices/recipeService.js";
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
