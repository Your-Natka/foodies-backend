import prisma from "../../prisma/client.ts";
import { Prisma } from "../../generated/prisma/client.js";

export const listFollows = async (
  direction: "followers" | "following",
  userId: string,
  viewerId: string,
  { page, limit }: { page: number; limit: number },
) => {
  const where: Prisma.UserWhereInput = direction === "followers"
    ? { following: { some: { followingId: userId } } }
    : { followers: { some: { followerId: userId } } };

  const [profile, users, total] = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.user.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        avatar: true,
        _count: { select: {
          recipes: true,
          followers: { where: { followerId: viewerId } },
        } },
        recipes: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 4,
          select: { id: true, thumb: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ], { isolationLevel: "RepeatableRead" });

  if (!profile) return null;

  return {
    data: users.map(({ _count, ...card }) => ({
      ...card,
      recipesCount: _count.recipes,
      isFollowing: _count.followers > 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const followUser = async (followerId: string, followingId: string) => {
  try {
    const { count } = await prisma.follow.createMany({
      data: { followerId, followingId },
      skipDuplicates: true,
    });
    return count === 1 ? "created" : "existing";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return null;
    }
    throw error;
  }
};

export const unfollowUser = async (followerId: string, followingId: string) => {
  const { count } = await prisma.follow.deleteMany({ where: { followerId, followingId } });
  if (count > 0) return true;

  return await prisma.user.count({ where: { id: { in: [followerId, followingId] } } }) === 2;
};
