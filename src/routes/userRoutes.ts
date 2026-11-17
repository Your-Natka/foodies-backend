import { Router } from "express";
import {
  getCurrentUser,
  getUserById,
  updateAvatar,
} from "../controllers/userController.ts";
import { authenticate } from "../middlewares/authMiddleware.ts";
import { upload } from "../middlewares/uploadMiddleware.ts";
import followRouter from "./followRoutes.ts";

const router = Router();

router.get("/current", authenticate, getCurrentUser);
router.use(followRouter);
router.get("/:id", authenticate, getUserById);
router.patch(
  "/current/avatar",
  authenticate,
  upload.single("avatar"),
  updateAvatar,
);

export default router;
