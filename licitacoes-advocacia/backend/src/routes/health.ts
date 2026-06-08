import { Router } from "express";
import {
  getFirestoreAdmin,
  isFirestoreAdminConfigured,
} from "../lib/firestoreAdmin.js";

const router = Router();

router.get("/", async (_req, res) => {
  let database: "connected" | "disconnected" | "not_configured" =
    "not_configured";

  if (isFirestoreAdminConfigured()) {
    try {
      await getFirestoreAdmin().collection("licitacoes").limit(1).get();
      database = "connected";
    } catch {
      database = "disconnected";
    }
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database,
  });
});

export default router;
