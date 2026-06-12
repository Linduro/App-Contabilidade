/** Reporta exceção ao Sentry (browser ou Node). */
export function captureException(error: unknown) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  if (!dsn) {
    console.error(error);
    return;
  }

  if (typeof window !== "undefined") {
    void import("@sentry/browser")
      .then((Sentry) => {
        if (!Sentry.getClient()) {
          Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "development" });
        }
        Sentry.captureException(error);
      })
      .catch(() => console.error(error));
    return;
  }

  void import("@sentry/node")
    .then((Sentry) => {
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV ?? "development",
          tracesSampleRate: 0.1,
        });
      }
      Sentry.captureException(error);
    })
    .catch((e) => console.error("[sentry]", e));
}
