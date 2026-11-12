import prisma from "../../prisma/client.ts";

export const getAllAreas = async () => {
  return prisma.area.findMany({
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
};
