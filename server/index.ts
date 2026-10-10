import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config.ts";
import authRoutes from "./routes/auth.ts";
import childrenRoutes from "./routes/children.ts";
import familiesRoutes from "./routes/families.ts";
import assignmentRoutes from "./routes/assignments.ts";
import auditRoutes from "./routes/audit.ts";
import gameRoutes from "./routes/games.ts";
import goalsRoutes from "./routes/goals.ts";
import familySessionRoutes from "./routes/familySession.ts";
import { securityRoutes } from "./routes/security.ts";
import { adminComplianceRoutes } from "./routes/admin-compliance.ts";
import researchRoutes from "./routes/research.ts";
import { childDataRoutes } from "./routes/childData.ts";
import { rewardRoutes } from "./routes/rewards.ts";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/children", childrenRoutes);
  app.use("/api/families", familiesRoutes);
  app.use("/api/assignments", assignmentRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/games", gameRoutes);
  app.use("/api/goals", goalsRoutes);
  app.use("/api/family", familySessionRoutes);
  app.use("/api/security", securityRoutes);
  app.use("/api/admin/compliance", adminComplianceRoutes);
  app.use("/api/research", researchRoutes);
  app.use("/api", childDataRoutes);
  app.use("/api", rewardRoutes);

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  createApp().listen(config.PORT, () => {
    console.log(`Playground Life API listening on port ${config.PORT}`);
  });
}
