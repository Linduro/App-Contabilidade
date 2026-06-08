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
    .collection("licitacoes")
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  const data = snap.docs.map(
    (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }),
  );
  return res.json({ data, count: data.length });
});

router.get("/:id", async (req, res) => {
  if (!isFirestoreAdminConfigured()) {
    return res.status(503).json({ error: "Firestore não configurado." });
  }

  const doc = await getFirestoreAdmin()
    .collection("licitacoes")
    .doc(req.params.id)
    .get();

  if (!doc.exists) {
    return res.status(404).json({ error: "Licitação não encontrada." });
  }

  return res.json({ data: { id: doc.id, ...doc.data() } });
});

export default router;
