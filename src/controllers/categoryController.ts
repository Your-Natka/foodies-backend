import type { Request, Response } from "express";
import { getAllCategories } from "../services/categoryService.ts";

export const getCategories = async (_req: Request, res: Response) => {
  const categories = await getAllCategories();

  res.status(200).json({
    data: categories,
  });
};
