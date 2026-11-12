import { Router } from "express";
import { getTestimonials } from "../controllers/testimonialController.ts";

const router = Router();

router.get("/", getTestimonials);

export default router;
