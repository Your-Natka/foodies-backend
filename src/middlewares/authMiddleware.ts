import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/generateTokens.ts";

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        type: "access";
      };
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Access token is required.",
    });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access token is required.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      decoded.type !== "access"
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid access token.",
      });
      return;
    }

    req.user = {
      sub: decoded.sub,
      type: "access",
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired access token.",
    });
  }
};
