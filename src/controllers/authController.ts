import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client.ts";

import { generateId } from "../utils/generateId.ts";
import {
  generateAccessToken,
  generateRefreshToken,
  getJwtSecret,
} from "../utils/generateTokens.ts";
import { hashPassword, comparePassword } from "../utils/hashPassword.ts";
import { hashToken } from "../utils/hashToken.ts";
import {
  clearRefreshCookie,
  setRefreshCookie,
} from "../utils/refreshCookie.ts";

import type { RegisterInput, LoginInput } from "../validators/authValidator.ts";

import { REFRESH_TOKEN_DURATION } from "../constants/auth.ts";
import {
  revokeRefreshToken,
  saveRefreshToken,
} from "../services/authService.ts";

const getRefreshTokenFromCookie = (req: Parameters<RequestHandler>[0]) => {
  const cookies = (
    req as typeof req & {
      cookies?: Record<string, string>;
    }
  ).cookies;

  return cookies?.refreshToken;
};

const isPrismaUniqueError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
};

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  createdAt: true,
} as const;

// POST /auth/register
export const register: RequestHandler = async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
    return;
  }

  const hashedPassword = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        id: generateId(),
        name,
        email,
        password: hashedPassword,
      },
      select: publicUserSelect,
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    await saveRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      user,
      accessToken,
    });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
      return;
    }

    throw error;
  }
};

// POST /auth/login
export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
    return;
  }

  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
    return;
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await saveRefreshToken(user.id, refreshToken);
  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    accessToken,
  });
};

// POST /auth/refresh
export const refresh: RequestHandler = async (req, res) => {
  const refreshToken = getRefreshTokenFromCookie(req);

  if (!refreshToken) {
    res.status(401).json({
      success: false,
      message: "Refresh token is missing.",
    });
    return;
  }

  let payload: jwt.JwtPayload;

  try {
    const decoded = jwt.verify(refreshToken, getJwtSecret());

    if (typeof decoded === "string") {
      res.status(401).json({
        success: false,
        message: "Invalid refresh token.",
      });
      return;
    }

    payload = decoded;
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token.",
    });
    return;
  }

  if (payload.type !== "refresh" || typeof payload.sub !== "string") {
    res.status(401).json({
      success: false,
      message: "Invalid refresh token.",
    });
    return;
  }

  const userId = payload.sub;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      refreshTokenHash: true,
      sessionExpiresAt: true,
    },
  });

  if (!user?.refreshTokenHash || !user.sessionExpiresAt) {
    res.status(401).json({
      success: false,
      message: "Session not found or revoked.",
    });
    return;
  }

  if (user.sessionExpiresAt <= new Date()) {
    await revokeRefreshToken(userId);

    clearRefreshCookie(res);

    res.status(401).json({
      success: false,
      message: "Session expired. Please sign in again.",
    });
    return;
  }

  if (hashToken(refreshToken) !== user.refreshTokenHash) {
    res.status(401).json({
      success: false,
      message: "Refresh token has been revoked.",
    });
    return;
  }

  const newAccessToken = generateAccessToken(userId);
  const newRefreshToken = generateRefreshToken(userId);

  const rotationResult = await prisma.user.updateMany({
    where: {
      id: userId,
      refreshTokenHash: user.refreshTokenHash,
      sessionExpiresAt: {
        gt: new Date(),
      },
    },
    data: {
      refreshTokenHash: hashToken(newRefreshToken),
      sessionExpiresAt: new Date(Date.now() + REFRESH_TOKEN_DURATION),
    },
  });

  if (rotationResult.count !== 1) {
    clearRefreshCookie(res);

    res.status(401).json({
      success: false,
      message: "Refresh token has already been used or revoked.",
    });
    return;
  }

  setRefreshCookie(res, newRefreshToken);

  res.status(200).json({
    success: true,
    accessToken: newAccessToken,
  });
};

// POST /auth/logout
export const logout: RequestHandler = async (req, res) => {
  const userId = req.user!.sub;

  await revokeRefreshToken(userId);
  clearRefreshCookie(res);

  res.status(204).end();
};
