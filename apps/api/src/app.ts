import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { queryOne } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { catalogueRouter } from "./routes/catalogue.js";
import { storyRouter } from "./routes/story.js";
import { workspaceRouter } from "./routes/workspace.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: "100kb" }));

  // Health check: proves the API is up and can reach PostgreSQL.
  app.get("/api/health", async (_req, res) => {
    const db = await queryOne<{ database: string; db_user: string; server_time: string }>(
      "SELECT current_database() AS database, current_user AS db_user, now() AS server_time",
    );
    res.json({ status: "ok", ...db });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", catalogueRouter);
  app.use("/api", storyRouter);
  app.use("/api", workspaceRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
