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
import { listFavorites, putFavorite, deleteFavorite } from "../controllers/favoriteController.js";

const router = Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("Authorization");
  next();
});
const optionalAuth: typeof authenticate = (req, res, next) => {
  if (req.headers.authorization !== undefined) authenticate(req, res, next);
  else next();
};

router.get("/", optionalAuth, listRecipes);
router.post("/", authenticate, uploadRecipePhoto, addRecipe);
router.get("/popular", optionalAuth, listPopularRecipes);
router.get("/own", authenticate, listOwnRecipes);
router.get("/favorites", authenticate, listFavorites);
router.put("/:id/favorite", authenticate, putFavorite);
router.delete("/:id/favorite", authenticate, deleteFavorite);
router.get("/:id", optionalAuth, getRecipe);
router.delete("/:id", authenticate, removeRecipe);

export default router;
