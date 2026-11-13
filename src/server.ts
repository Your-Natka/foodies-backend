import "dotenv/config";
import app from "./app.js";
import prisma from "../prisma/client.ts";

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    await prisma.$connect();

    console.log("Successfully connected to PostgreSQL!");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Foodies API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
