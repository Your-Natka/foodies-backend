import { Router } from "express";
import { listRecipes } from "../controllers/recipeController.js";

const router = Router();

router.get("/", listRecipes);

export default router;
