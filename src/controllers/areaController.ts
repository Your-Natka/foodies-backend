import type { Request, Response } from "express";
import { getAllAreas } from "../services/areaService.ts";

export const getAreas = async (_req: Request, res: Response) => {
  const areas = await getAllAreas();

  res.status(200).json({
    data: areas,
  });
};
