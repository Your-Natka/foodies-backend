import type { RequestHandler } from "express";
import prisma from "../../prisma/client.ts";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.ts";

// Get current user profile
export const getCurrentUser: RequestHandler = async (req, res) => {
  const userId = req.user!.sub;

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      _count: {
        select: {
          recipes: true,
          followers: true,
          following: true,
        },
      },
      recipes: {
        select: {
          id: true,
          title: true,
          description: true,
          thumb: true,
        },
      },
      favorites: {
        select: {
          recipeId: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({
      error: "User not found",
    });
    return;
  }

  res.status(200).json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    recipesCount: user._count.recipes,
    favoritesCount: user.favorites.length,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    recipes: user.recipes,
  });
};

export const getUserById: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(400).json({
      error: "Invalid user ID",
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      _count: {
        select: {
          recipes: true,
          followers: true,
        },
      },
      followers: {
        where: { followerId: req.user!.sub },
        select: { followerId: true },
        take: 1,
      },
      recipes: {
        select: {
          id: true,
          title: true,
          description: true,
          thumb: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({
      error: "User not found",
    });
    return;
  }

  res.set("Cache-Control", "private, no-store").status(200).json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    recipesCount: user._count.recipes,
    followersCount: user._count.followers,
    isFollowing: user.followers.length > 0,
    recipes: user.recipes,
  });
};

export const updateAvatar: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Avatar file is required" });
      return;
    }

    const avatarUrl = await uploadToCloudinary(req.file, {
      folder: "foodies/avatars",
    });

    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    res.status(200).json({
      message: "Avatar updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};
