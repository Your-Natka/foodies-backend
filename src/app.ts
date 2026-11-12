import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import openApi from "../docs/openapi.json" with { type: "json" };

import authRouter from "./routes/authRoutes.ts";
import userRouter from "./routes/userRoutes.ts";
import recipeRoutes from "./routes/recipeRoutes.ts";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        Object.assign(new Error("CORS: Origin not allowed"), {
          status: 403,
        }),
      );
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Foodies API is running!",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/recipes", recipeRoutes);
app.get("/api-docs/openapi.json", (_req, res) => res.json(openApi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApi, {
  customSiteTitle: "Foodies Recipes API",
  swaggerOptions: { persistAuthorization: false },
}));

app.use(notFound);
app.use(errorHandler);

export default app;
