import type { CookieOptions } from "express";
import { REFRESH_TOKEN_DURATION } from "../constants/auth.ts";

const isProduction = process.env.NODE_ENV === "production";

export const REFRESH_COOKIE_NAME = "refreshToken";

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/auth",
};

export const setRefreshCookie = (
  res: import("express").Response,
  token: string,
): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions,
    maxAge: REFRESH_TOKEN_DURATION,
  });
};

export const clearRefreshCookie = (res: import("express").Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
};
