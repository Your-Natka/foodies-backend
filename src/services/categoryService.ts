import prisma from "../../prisma/client.ts";

export const getAllCategories = async () => {
  return prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
  });
};
