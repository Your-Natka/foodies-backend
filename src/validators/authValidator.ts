import { z } from "zod";

// registration validation
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ message: "Invalid email format" })),

  password: z.string().min(8, "Password must be at least 8 characters"),

  name: z.string().trim().min(2, "Name must be at least 2 characters"),
});

// login validation
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ message: "Invalid email format" })),

  password: z.string().min(1, "Password is required"),
});

// refresh token validation
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Inferred TypeScript types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
