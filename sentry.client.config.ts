import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e229c66d2c3a8057030cebfe355663b3@o4511976719515648.ingest.us.sentry.io/4511976730591232",
  tracesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
