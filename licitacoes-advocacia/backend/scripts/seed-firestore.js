import "dotenv/config";
import { getFirestoreAdmin } from "../src/lib/firestoreAdmin.ts";
import {
  ESPECIALIDADES_CATALOG,
  OWNER_CONFIG,
} from "../src/lib/especialidadesCatalog.js";

async function seedFirestore() {
  const db = getFirestoreAdmin();
  const batch = db.batch();

  for (const esp of ESPECIALIDADES_CATALOG) {
    const ref = db.collection("licitacoesEspecialidades").doc(esp.slug);
    batch.set(
      ref,
      {
        ...esp,
        id: esp.slug,
        ativo: true,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  batch.set(
    db.collection("licitacoesConfig").doc("owner"),
    {
      ...OWNER_CONFIG,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );

  await batch.commit();
  console.log("Firestore seed concluído — especialidades + owner cartoonhq@gmail.com");
}

seedFirestore().catch((error) => {
  console.error("Falha no seed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
