import { z } from "zod";

const positiveInteger = (maximum: number) =>
  z.string().trim().regex(/^[1-9]\d*$/).transform(Number).pipe(z.int().max(maximum));

const maxOffset = 2_147_483_647;

export const followPaginationSchema = z.strictObject({
  page: positiveInteger(maxOffset).default(1),
  limit: positiveInteger(100).default(5),
}).refine(({ page, limit }) => (page - 1) * limit <= maxOffset, {
  path: ["page"],
  message: "Page offset is too large",
});

export const followUserIdSchema = z.string().regex(/^[a-f\d]{24}$/i).toLowerCase();
