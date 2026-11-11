import type { Request, Response } from "express";
import { getRecipes } from "../sevices/recipeService.js";
import { parseRecipeQuery } from "../validators/recipeValidator.js";

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
