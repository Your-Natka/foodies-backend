import { Router } from "express";
import {
  addRecipe,
  getRecipe,
  listOwnRecipes,
  listPopularRecipes,
  listRecipes,
  removeRecipe,
} from "../controllers/recipeController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { uploadRecipePhoto } from "../middlewares/recipePhotoMiddleware.js";

const router = Router();

router.get("/", listRecipes);
router.post("/", authenticate, uploadRecipePhoto, addRecipe);
router.get("/popular", listPopularRecipes);
router.get("/own", authenticate, listOwnRecipes);
router.get("/:id", getRecipe);
router.delete("/:id", authenticate, removeRecipe);

export default router;
