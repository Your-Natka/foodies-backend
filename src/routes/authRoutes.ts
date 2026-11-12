import { Router } from "express";

import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/authController.ts";

import { authenticate } from "../middlewares/authMiddleware.ts";
import { validateBody } from "../middlewares/validateMiddleware.ts";

import { registerSchema, loginSchema } from "../validators/authValidator.ts";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", authenticate, logout);

export default router;
