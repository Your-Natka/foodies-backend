import { Router } from "express";
import { getCategories } from "../controllers/categoryController.ts";

const router = Router();

router.get("/", getCategories);

export default router;
