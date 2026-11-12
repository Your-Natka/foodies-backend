import { Router } from "express";
import {
  getRecipe,
  listOwnRecipes,
  listPopularRecipes,
  listRecipes,
  removeRecipe,
} from "../controllers/recipeController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", listRecipes);
router.get("/popular", listPopularRecipes);
router.get("/own", authenticate, listOwnRecipes);
router.get("/:id", getRecipe);
router.delete("/:id", authenticate, removeRecipe);

export default router;
