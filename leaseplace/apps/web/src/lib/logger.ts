import "server-only";
import pino from "pino";

/** Journaux structurés ; aucune donnée personnelle ni secret en clair. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "leaseplace-web" },
  redact: {
    paths: [
      "email",
      "*.email",
      "password",
      "*.password",
      "token",
      "*.token",
      "otp",
      "*.otp",
      "url",
    ],
    censor: "[masqué]",
  },
});
