import { Router } from "express";
import { getCurrentUser, getUserById } from "../controllers/userController.ts";
import { authenticate } from "../middlewares/authMiddleware.ts";
import { updateAvatar } from "../controllers/userController.ts";
import { upload } from "../middlewares/uploadMiddleware.ts";

const router = Router();

router.get("/current", authenticate, getCurrentUser);
router.get("/:id", authenticate, getUserById);
router.patch(
  "/current/avatar",
  authenticate,
  upload.single("avatar"),
  updateAvatar,
);

export default router;
