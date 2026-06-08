import { Router } from "express";
import { getSupabase } from "../lib/supabase.js";

const router = Router();

router.get("/", async (_req, res) => {
  const db = getSupabase();

  if (!db) {
    return res.status(503).json({
      error: "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const { data, error } = await db
    .from("especialidades_advogados")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data, count: data?.length ?? 0 });
});

export default router;
