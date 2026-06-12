/** Reporta exceção (browser). Sem Sentry no bundle do servidor via este módulo. */
export function captureException(error: unknown) {
  console.error(error);
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return;

  void import("@sentry/browser")
    .then((Sentry) => {
      if (!Sentry.getClient()) {
        Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "development" });
      }
      Sentry.captureException(error);
    })
    .catch(() => console.error(error));
}
