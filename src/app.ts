import express from "express";
import cors from "cors";
import helmet from "helmet";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";
import recipeRoutes from "./routes/recipeRoutes.js";

const app = express();
const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) || [];

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(Object.assign(new Error("CORS: Origin not allowed"), { status: 403 }));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Foodies API is running!",
  });
});

app.use("/api/recipes", recipeRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
