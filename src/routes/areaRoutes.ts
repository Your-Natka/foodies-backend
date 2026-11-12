import { Router } from "express";
import { getAreas } from "../controllers/areaController.ts";

const router = Router();

router.get("/", getAreas);

export default router;
