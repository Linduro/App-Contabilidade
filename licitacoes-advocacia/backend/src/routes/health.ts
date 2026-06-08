import { Router } from "express";
import { getSupabase } from "../lib/supabase.js";
import { isSupabaseConfigured } from "../config/env.js";

const router = Router();

router.get("/", async (_req, res) => {
  let database: "connected" | "disconnected" | "not_configured" =
    "not_configured";

  if (isSupabaseConfigured()) {
    const db = getSupabase();
    const { error } = await db!.from("licitacoes").select("id").limit(1);
    database = error ? "disconnected" : "connected";
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database,
  });
});

export default router;
