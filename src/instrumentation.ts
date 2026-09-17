import type { Instrumentation } from "next";

// Structured server-error logging so failures are visible in Vercel's log drain even without a third-party APM configured.
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  console.error(JSON.stringify({
    level: "error",
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: request.path,
    method: request.method,
    timestamp: new Date().toISOString(),
  }));
};
