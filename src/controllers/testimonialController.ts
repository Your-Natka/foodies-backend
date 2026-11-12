import type { Request, Response } from "express";
import { getAllTestimonials } from "../services/testimonialService.ts";

export const getTestimonials = async (_req: Request, res: Response) => {
  const testimonials = await getAllTestimonials();

  res.status(200).json({
    data: testimonials,
  });
};
