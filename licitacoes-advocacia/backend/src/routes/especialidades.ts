import { Router } from "express";
import {
  getFirestoreAdmin,
  isFirestoreAdminConfigured,
} from "../lib/firestoreAdmin.js";

const router = Router();

router.get("/", async (_req, res) => {
  if (!isFirestoreAdminConfigured()) {
    return res.status(503).json({
      error:
        "Firestore não configurado. Defina GOOGLE_APPLICATION_CREDENTIALS.",
    });
  }

  const snap = await getFirestoreAdmin()
    .collection("licitacoesEspecialidades")
    .get();

  const data = snap.docs
    .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((row: Record<string, unknown>) => row.ativo !== false)
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      String(a.nome).localeCompare(String(b.nome)),
    );

  return res.json({ data, count: data.length });
});

export default router;
