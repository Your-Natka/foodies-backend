import prisma from "../../prisma/client.ts";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  extractPublicIdFromUrl,
} from "../utils/uploadToCloudinary.ts";

export const getCurrentUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    recipesCount: user._count.recipes,
    favoritesCount: user.favorites.length,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    recipes: user.recipes,
  };
};

export const getUserProfileById = async (
  userId: string,
  currentUserId: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
        where: { followerId: currentUserId },
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

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    recipesCount: user._count.recipes,
    followersCount: user._count.followers,
    isFollowing: user.followers.length > 0,
    recipes: user.recipes,
  };
};

export const updateUserAvatar = async (
  userId: string,
  file: Express.Multer.File,
) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  if (!currentUser) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
    });
  }

  const newAvatar = await uploadImageToCloudinary(file, {
    folder: "foodies/avatars",
  });

  try {
    // save the new avatar URL in the database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: newAvatar.url,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    // delete the old avatar only after successful database update
    if (currentUser.avatar) {
      const oldPublicId = extractPublicIdFromUrl(currentUser.avatar);

      if (oldPublicId && oldPublicId !== newAvatar.publicId) {
        try {
          await deleteImageFromCloudinary(oldPublicId);
        } catch (error) {
          console.error(
            "Failed to delete previous avatar from Cloudinary:",
            error,
          );
        }
      }
    }

    return updatedUser;
  } catch (error) {
    // remove the newly uploaded image if database update fails
    try {
      await deleteImageFromCloudinary(newAvatar.publicId);
    } catch (cleanupError) {
      console.error("Failed to clean up newly uploaded avatar:", cleanupError);
    }

    throw error;
  }
};
