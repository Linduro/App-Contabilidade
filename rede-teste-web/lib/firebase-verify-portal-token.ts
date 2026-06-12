import { createRemoteJWKSet, jwtVerify } from "jose"

const projectId = process.env.FIREBASE_PROJECT_ID || "contabilidade-ebed6"

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
)

export type VerifiedPortalToken = {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
}

/** Valida ID token Firebase do portal sem service account (só project ID público). */
export async function verifyFirebasePortalIdToken(
  idToken: string,
): Promise<VerifiedPortalToken> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })

  const uid = payload.sub
  if (!uid) throw new Error("Token sem sub")

  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  }
}
