import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // tratado na pagina de login via res.data.twoFactorRedirect
      },
    }),
  ],
});

export const { useSession, signIn, signOut, signUp, twoFactor } = authClient;
