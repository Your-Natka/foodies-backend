import type { RequestHandler } from "express";
import {
  getCurrentUserProfile,
  getUserProfileById,
  updateUserAvatar,
} from "../services/userService.ts";

export const getCurrentUser: RequestHandler = async (req, res) => {
  const user = await getCurrentUserProfile(req.user!.sub);

  if (!user) {
    res.status(404).json({
      error: "User not found",
    });
    return;
  }

  res.status(200).json(user);
};

export const getUserById: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(400).json({
      error: "Invalid user ID",
    });
    return;
  }

  const user = await getUserProfileById(id, req.user!.sub);

  if (!user) {
    res.status(404).json({
      error: "User not found",
    });
    return;
  }

  res.set("Cache-Control", "private, no-store").status(200).json(user);
};

export const updateAvatar: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: "Avatar file is required",
      });
      return;
    }

    const user = await updateUserAvatar(req.user!.sub, req.file);

    res.status(200).json({
      message: "Avatar updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};
