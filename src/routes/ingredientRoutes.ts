import { Router } from "express";
import { getIngredients } from "../controllers/ingredientController.ts";

const router = Router();

router.get("/", getIngredients);

export default router;
