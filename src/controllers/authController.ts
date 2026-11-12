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
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
} from "../validators/authValidator.ts";
import { REFRESH_TOKEN_DURATION } from "../constants/auth.ts";
import { saveRefreshToken } from "../services/authService.ts";

// Register new user
export const register: RequestHandler = async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(409).json({
      error: "Email already registered",
    });
    return;
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      id: generateId(),
      name,
      email,
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // Save refresh token hash
  await saveRefreshToken(user.id, refreshToken);

  res.status(201).json({
    user,
    accessToken,
    refreshToken,
  });
};

// Login user
export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginInput;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    res.status(401).json({
      error: "Invalid email or password",
    });
    return;
  }

  // Compare password
  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    res.status(401).json({
      error: "Invalid email or password",
    });
    return;
  }

  // Generate tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // Replace previous refresh token
  await saveRefreshToken(user.id, refreshToken);

  res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  });
};

// Refresh tokens with rotation
export const refresh: RequestHandler = async (req, res) => {
  const { refreshToken } = req.body as RefreshInput;

  // Verify refresh token
  let payload: jwt.JwtPayload;

  try {
    const decoded = jwt.verify(refreshToken, getJwtSecret());

    if (typeof decoded === "string") {
      res.status(401).json({
        error: "Invalid refresh token",
      });
      return;
    }

    payload = decoded;
  } catch {
    res.status(401).json({
      error: "Invalid or expired refresh token",
    });
    return;
  }

  // Check token payload
  if (payload.type !== "refresh" || typeof payload.sub !== "string") {
    res.status(401).json({
      error: "Invalid refresh token",
    });
    return;
  }

  const userId = payload.sub;

  // Find user and stored refresh token hash
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      refreshTokenHash: true,
      sessionExpiresAt: true,
    },
  });

  if (!user || !user.refreshTokenHash || !user.sessionExpiresAt) {
    res.status(401).json({
      error: "Refresh token not found or revoked",
    });
    return;
  }

  // Check session expiration
  if (user.sessionExpiresAt <= new Date()) {
    res.status(401).json({
      error: "Session expired",
    });
    return;
  }

  // Compare provided token hash with stored hash
  const isTokenValid = hashToken(refreshToken) === user.refreshTokenHash;

  if (!isTokenValid) {
    res.status(401).json({
      error: "Refresh token not found or revoked",
    });
    return;
  }

  // Generate new token pair
  const newAccessToken = generateAccessToken(userId);
  const newRefreshToken = generateRefreshToken(userId);

  const newRefreshTokenHash = hashToken(newRefreshToken);

  const newSessionExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DURATION);

  // Replace old refresh token
  const rotationResult = await prisma.user.updateMany({
    where: {
      id: userId,
      refreshTokenHash: user.refreshTokenHash,
      sessionExpiresAt: {
        gt: new Date(),
      },
    },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      sessionExpiresAt: newSessionExpiresAt,
    },
  });

  if (rotationResult.count !== 1) {
    res.status(401).json({
      error: "Refresh token has already been used or revoked",
    });
    return;
  }

  res.status(200).json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
};

// Logout user
export const logout: RequestHandler = async (req, res) => {
  const userId = req.user!.sub;

  // Revoke refresh token and end session
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshTokenHash: null,
      sessionExpiresAt: null,
    },
  });

  res.status(204).end();
};
