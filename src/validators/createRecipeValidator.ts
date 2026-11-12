import { z } from "zod";

const ingredientsSchema = z.array(z.object({
  ingredientId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid ingredient ID").transform((id) => id.toLowerCase()),
  measure: z.string().trim().min(1).max(100),
}).strict()).min(1, "Add at least one ingredient").superRefine((ingredients, context) => {
  const ids = new Set<string>();
  ingredients.forEach((ingredient, index) => {
    if (ids.has(ingredient.ingredientId)) {
      context.addIssue({ code: "custom", path: [index, "ingredientId"], message: "Ingredient must not repeat" });
    }
    ids.add(ingredient.ingredientId);
  });
});

export const createRecipeSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  area: z.string().trim().min(1).max(100),
  time: z.string().trim().regex(/^[1-9]\d*$/, "Time must be a positive whole number")
    .transform(Number).pipe(z.number().int().min(1).max(2147483647)),
  instructions: z.string().trim().min(1).max(1000),
  ingredients: z.string().transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({ code: "custom", message: "Ingredients must be a JSON array" });
      return z.NEVER;
    }
  }).pipe(ingredientsSchema),
}).strict();

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
