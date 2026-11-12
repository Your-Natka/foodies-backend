import prisma from "../../prisma/client.ts";
import { hashToken } from "../utils/hashToken.ts";
import { REFRESH_TOKEN_DURATION } from "../constants/auth.ts";

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
