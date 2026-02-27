import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    // GlitchTip은 트레이싱/리플레이를 지원하지 않으므로 비활성화
    tracesSampleRate: 0,
  });
}
