import { Router } from "express";
import { getRecipe, listPopularRecipes, listRecipes } from "../controllers/recipeController.js";

const router = Router();

router.get("/", listRecipes);
router.get("/popular", listPopularRecipes);
router.get("/:id", getRecipe);

export default router;
