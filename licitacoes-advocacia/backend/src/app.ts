import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import healthRouter from "./routes/health.js";
import licitacoesRouter from "./routes/licitacoes.js";
import especialidadesRouter from "./routes/especialidades.js";
import matchesRouter from "./routes/matches.js";
import classifyRouter from "./routes/classify.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/licitacoes", licitacoesRouter);
app.use("/api/especialidades", especialidadesRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/classify", classifyRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

export default app;
