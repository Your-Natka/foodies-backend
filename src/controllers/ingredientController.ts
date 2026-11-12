import type { Request, Response } from "express";
import { getAllIngredients } from "../services/ingredientService.ts";

export const getIngredients = async (_req: Request, res: Response) => {
  const ingredients = await getAllIngredients();

  res.status(200).json({
    data: ingredients,
  });
};
