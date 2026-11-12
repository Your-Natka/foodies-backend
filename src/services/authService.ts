import prisma from "../../prisma/client.ts";
import { hashToken } from "../utils/hashToken.ts";
import { REFRESH_TOKEN_DURATION } from "../constants/auth.ts";

export const saveRefreshToken = async (
  userId: string,
  refreshToken: string,
): Promise<void> => {
  const refreshTokenHash = hashToken(refreshToken);

  const sessionExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DURATION);

  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshTokenHash,
      sessionExpiresAt,
    },
  });
};
