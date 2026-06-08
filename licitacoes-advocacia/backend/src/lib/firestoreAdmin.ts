import admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

let initialized = false;

function parseServiceAccountJson(): admin.ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as admin.ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON inválido (JSON malformado).");
  }
}

export function isFirestoreAdminConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  );
}

export function getFirestoreAdmin(): Firestore {
  if (!initialized) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID || "contabilidade-ebed6";

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountJson = parseServiceAccountJson();

    if (serviceAccountJson) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountJson),
        projectId,
      });
    } else if (serviceAccountPath) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        projectId,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    } else {
      throw new Error(
        "Firestore Admin não configurado. Defina GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT_PATH.",
      );
    }

    initialized = true;
  }

  return admin.firestore();
}
