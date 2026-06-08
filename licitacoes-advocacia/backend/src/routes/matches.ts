import { Router } from "express";
import {
  getFirestoreAdmin,
  isFirestoreAdminConfigured,
} from "../lib/firestoreAdmin.js";

const router = Router();

router.get("/", async (req, res) => {
  if (!isFirestoreAdminConfigured()) {
    return res.status(503).json({
      error:
        "Firestore não configurado. Defina GOOGLE_APPLICATION_CREDENTIALS.",
    });
  }

  const minScore = parseFloat(req.query.minScore as string) || 0.5;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

  const snap = await getFirestoreAdmin()
    .collection("licitacoesMatches")
    .orderBy("relevancia_score", "desc")
    .limit(limit)
    .get();

  const data = snap.docs
    .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter(
      (row: Record<string, unknown>) =>
        Number(row.relevancia_score) >= minScore,
    );

  return res.json({ data, count: data.length });
});

export default router;
