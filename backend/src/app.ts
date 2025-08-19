import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import eibRoutes from "./routes/eib.routes.js";
import reportRoutes from "./routes/reports.routes.js";
import soapRoutes from "./routes/soap.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// API routes
app.use("/api/eib", eibRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/soap", soapRoutes);

// Static UI
app.use("/", express.static(path.join(__dirname, "public")));

export default app;
