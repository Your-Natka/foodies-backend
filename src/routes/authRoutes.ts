import { Router } from "express";
import {
  loginLimiter,
  registerLimiter,
} from "../middlewares/rateLimitMiddleware.ts";
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

router.post(
  "/register",
  registerLimiter,
  validateBody(registerSchema),
  register,
);

router.post("/login", loginLimiter, validateBody(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", authenticate, logout);

export default router;
