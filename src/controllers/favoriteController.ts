import type { Request, Response } from "express";
import { addFavorite, removeFavorite, requireFavoriteUser } from "../services/favoriteService.js";
import { getRecipes } from "../services/recipeService.js";
import { parseRecipeId, parseRecipeQuery } from "../validators/recipeValidator.js";

export const listFavorites = async (req: Request, res: Response) => {
  const { query, errors } = parseRecipeQuery(req.query, ["page", "limit"]);
  if (errors.length) {
    res.status(400).json({ success: false, message: "Invalid query parameters", errors });
    return;
  }
  await requireFavoriteUser(req.user!.sub);
  res.json(await getRecipes(query, req.user!.sub, true));
};

export const putFavorite = async (req: Request, res: Response) => {
  const id = parseRecipeId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Invalid recipe ID" });
    return;
  }
  const created = await addFavorite(req.user!.sub, id);
  res.status(created ? 201 : 200).json({ data: { recipeId: id, isFavorite: true } });
};

export const deleteFavorite = async (req: Request, res: Response) => {
  const id = parseRecipeId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Invalid recipe ID" });
    return;
  }
  await removeFavorite(req.user!.sub, id);
  res.status(204).end();
};
