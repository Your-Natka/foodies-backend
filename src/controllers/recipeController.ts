import type { Request, Response } from "express";
import {
  createRecipe,
  deleteOwnRecipe,
  getPopularRecipes,
  getRecipeById,
  getRecipes,
} from "../services/recipeService.js";
import { parseRecipeId, parseRecipeQuery } from "../validators/recipeValidator.js";
import { createRecipeSchema } from "../validators/createRecipeValidator.js";

export const addRecipe = async (req: Request, res: Response) => {
  const result = createRecipeSchema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.flatMap((issue) => {
      if (issue.code === "unrecognized_keys") {
        return issue.keys.map((key) => ({
          field: [...issue.path, key].join("."),
          message: "Unknown field",
        }));
      }
      return [{ field: issue.path.join(".") || "body", message: issue.message }];
    });
    res.status(400).json({ success: false, message: "Invalid recipe data", errors });
    return;
  }

  const recipe = await createRecipe(result.data, req.user!.sub, req.file!);
  res.status(201).json({ data: recipe });
};

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

  const result = await getRecipes(query, req.user?.sub);
  res.status(200).json(result);
};

export const listOwnRecipes = async (req: Request, res: Response) => {
  const { query, errors } = parseRecipeQuery(req.query, ["page", "limit"]);

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: "Invalid query parameters", errors });
    return;
  }

  const result = await getRecipes({ ...query, ownerId: req.user!.sub }, req.user!.sub);
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

  const recipe = await getRecipeById(id, req.user?.sub);
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

  const data = await getPopularRecipes(req.user?.sub);
  res.status(200).json({ data });
};
