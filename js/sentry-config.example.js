/* Copy to js/sentry-config.js after creating a real Sentry project.
   Keep the DSN out of public repos if your process treats it as environment config. */
window.SGF_SENTRY_CONFIG = Object.freeze({
  dsn: '',
  environment: 'production',
  release: 'skibidi-gofood@20260526v21',
  tracesSampleRate: 0.05
});
