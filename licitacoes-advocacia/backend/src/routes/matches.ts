import { Router } from "express";
import { getSupabase } from "../lib/supabase.js";

const router = Router();

router.get("/", async (req, res) => {
  const db = getSupabase();

  if (!db) {
    return res.status(503).json({
      error: "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const minScore = parseFloat(req.query.minScore as string) || 0.5;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

  const { data, error } = await db
    .from("matches")
    .select(
      `
      *,
      licitacao:licitacoes(*),
      especialidade:especialidades_advogados(*)
    `,
    )
    .gte("relevancia_score", minScore)
    .order("relevancia_score", { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data, count: data?.length ?? 0 });
});

export default router;
