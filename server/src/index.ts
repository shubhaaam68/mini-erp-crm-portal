import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import authRoutes from "./routes/auth";
import challanRoutes from "./routes/challans";
import customerRoutes from "./routes/customers";
import dashboardRoutes from "./routes/dashboard";
import productRoutes from "./routes/products";
import stockMovementRoutes from "./routes/stockMovements";

export const app = express();

app.use(cors({ origin: env.corsOrigins.includes("*") ? true : env.corsOrigins }));
app.use(express.json());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/products", productRoutes);
app.use("/stock-movements", stockMovementRoutes);
app.use("/challans", challanRoutes);
app.use("/dashboard", dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
}
