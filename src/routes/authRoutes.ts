import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/authController.ts";
import { authenticate } from "../middlewares/authMiddleware.ts";
import { validateBody } from "../middlewares/validateMiddleware.ts";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../validators/authValidator.ts";

const router = Router();

// public routes
router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", validateBody(refreshSchema), refresh);

// private routes
router.post("/logout", authenticate, logout);

export default router;
