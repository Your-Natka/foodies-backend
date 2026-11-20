import { rateLimit } from "express-rate-limit";

const createRateLimiter = (
  windowMs: number,
  limit: number,
  message: string,
  skipSuccessfulRequests = false,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: {
      success: false,
      message,
    },
  });

export const loginLimiter = createRateLimiter(
  15 * 60 * 1000,
  5,
  "Too many login attempts. Please try again in 15 minutes.",
  true,
);

export const registerLimiter = createRateLimiter(
  60 * 60 * 1000,
  5,
  "Too many registration attempts. Please try again later.",
);

export const uploadLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  "Too many upload requests. Please try again later.",
);
