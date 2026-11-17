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

import { REFRESH_TOKEN_DURATION } from "../constants/auth.ts";

import type { RegisterInput, LoginInput } from "../validators/authValidator.ts";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  createdAt: true,
} as const;

const isPrismaUniqueError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
};

export const saveRefreshToken = async (
  userId: string,
  refreshToken: string,
): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshTokenHash: hashToken(refreshToken),
      sessionExpiresAt: new Date(Date.now() + REFRESH_TOKEN_DURATION),
    },
  });
};

export const revokeRefreshToken = async (userId: string): Promise<void> => {
  await prisma.user.updateMany({
    where: { id: userId },
    data: {
      refreshTokenHash: null,
      sessionExpiresAt: null,
    },
  });
};

export const registerUser = async (data: RegisterInput) => {
  const { name, email, password } = data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return { success: false as const, reason: "email_exists" as const };
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

    return {
      success: true as const,
      user,
      accessToken,
      refreshToken,
    };
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return { success: false as const, reason: "email_exists" as const };
    }

    throw error;
  }
};

export const loginUser = async (data: LoginInput) => {
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { success: false as const };
  }

  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    return { success: false as const };
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await saveRefreshToken(user.id, refreshToken);

  return {
    success: true as const,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  };
};

type RefreshResult =
  | { success: true; accessToken: string; refreshToken: string }
  | {
      success: false;
      reason:
        | "missing"
        | "invalid"
        | "invalid_or_expired"
        | "session_not_found"
        | "session_expired"
        | "revoked"
        | "already_used";
    };

export const refreshUserTokens = async (
  refreshToken: string | undefined,
): Promise<RefreshResult> => {
  if (!refreshToken) {
    return { success: false, reason: "missing" };
  }

  let payload: jwt.JwtPayload;

  try {
    const decoded = jwt.verify(refreshToken, getJwtSecret());

    if (typeof decoded === "string") {
      return { success: false, reason: "invalid" };
    }

    payload = decoded;
  } catch {
    return { success: false, reason: "invalid_or_expired" };
  }

  if (payload.type !== "refresh" || typeof payload.sub !== "string") {
    return { success: false, reason: "invalid" };
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
    return { success: false, reason: "session_not_found" };
  }

  if (user.sessionExpiresAt <= new Date()) {
    await revokeRefreshToken(userId);
    return { success: false, reason: "session_expired" };
  }

  if (hashToken(refreshToken) !== user.refreshTokenHash) {
    return { success: false, reason: "revoked" };
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
    return { success: false, reason: "already_used" };
  }

  return {
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logoutUser = async (userId: string): Promise<void> => {
  await revokeRefreshToken(userId);
};
