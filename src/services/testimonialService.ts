import prisma from "../../prisma/client.ts";

export const getAllTestimonials = async () => {
  return prisma.testimonial.findMany({
    select: {
      id: true,
      testimonial: true,
      owner: { select: { id: true, name: true } },
    },
    orderBy: { id: "asc" },
  });
};
