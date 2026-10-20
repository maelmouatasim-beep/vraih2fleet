import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { buildCsp, generateNonce } from "./lib/csp";

const handleI18n = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    https: request.nextUrl.protocol === "https:",
  });
  // Next lit le nonce dans l'en-tête CSP de la requête pour ses propres scripts.
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);
  const response = handleI18n(request);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Ni l'API, ni les fichiers statiques, ni les ressources de Next.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
