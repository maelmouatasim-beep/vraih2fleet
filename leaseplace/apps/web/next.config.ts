import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// En-têtes de sécurité statiques ; la CSP (avec nonce) est posée par le middleware.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const config: NextConfig = {
  poweredByHeader: false,
  // Le lint tourne à part (pnpm lint, CI) avec la config partagée.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  transpilePackages: [
    "@leaseplace/ui",
    "@leaseplace/domain",
    "@leaseplace/db",
    "@leaseplace/integrations",
  ],
  serverExternalPackages: ["pino"],
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: securityHeaders }]);
  },
};

export default withNextIntl(config);
