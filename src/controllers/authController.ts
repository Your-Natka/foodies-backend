import type { RequestHandler } from "express";

import {
  registerUser,
  loginUser,
  refreshUserTokens,
  logoutUser,
} from "../services/authService.ts";

import {
  clearRefreshCookie,
  setRefreshCookie,
} from "../utils/refreshCookie.ts";

import type { RegisterInput, LoginInput } from "../validators/authValidator.ts";

const getRefreshTokenFromCookie = (
  req: Parameters<RequestHandler>[0],
): string | undefined => {
  const cookies = (
    req as typeof req & {
      cookies?: Record<string, string>;
    }
  ).cookies;

  return cookies?.refreshToken;
};

export const register: RequestHandler = async (req, res) => {
  const result = await registerUser(req.body as RegisterInput);

  if (!result.success) {
    res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
    return;
  }

  setRefreshCookie(res, result.refreshToken);

  res.status(201).json({
    success: true,
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const login: RequestHandler = async (req, res) => {
  const result = await loginUser(req.body as LoginInput);

  if (!result.success) {
    res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
    return;
  }

  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const refresh: RequestHandler = async (req, res) => {
  const refreshToken = getRefreshTokenFromCookie(req);
  const result = await refreshUserTokens(refreshToken);

  if (!result.success) {
    if (
      result.reason === "session_expired" ||
      result.reason === "already_used"
    ) {
      clearRefreshCookie(res);
    }

    const responses = {
      missing: {
        status: 401,
        message: "Refresh token is missing.",
      },
      invalid: {
        status: 401,
        message: "Invalid refresh token.",
      },
      invalid_or_expired: {
        status: 401,
        message: "Invalid or expired refresh token.",
      },
      session_not_found: {
        status: 401,
        message: "Session not found or revoked.",
      },
      session_expired: {
        status: 401,
        message: "Session expired. Please sign in again.",
      },
      revoked: {
        status: 401,
        message: "Refresh token has been revoked.",
      },
      already_used: {
        status: 401,
        message: "Refresh token has already been used or revoked.",
      },
    } as const;

    const response = responses[result.reason];

    res.status(response.status).json({
      success: false,
      message: response.message,
    });
    return;
  }

  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    accessToken: result.accessToken,
  });
};

export const logout: RequestHandler = async (req, res) => {
  await logoutUser(req.user!.sub);

  clearRefreshCookie(res);

  res.status(204).end();
};
