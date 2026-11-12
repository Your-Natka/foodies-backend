import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_LIFETIME,
  REFRESH_TOKEN_LIFETIME,
} from "../constants/auth.ts";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

export const generateAccessToken = (userId: string): string => {
  return jwt.sign(
    {
      sub: userId,
      type: "access",
      jti: randomUUID(),
    },
    getJwtSecret(),
    {
      expiresIn: ACCESS_TOKEN_LIFETIME,
    },
  );
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    {
      sub: userId,
      type: "refresh",
      jti: randomUUID(),
    },
    getJwtSecret(),
    {
      expiresIn: REFRESH_TOKEN_LIFETIME,
    },
  );
};

export { getJwtSecret };
