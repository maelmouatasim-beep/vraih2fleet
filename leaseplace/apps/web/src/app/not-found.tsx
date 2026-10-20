import Link from "next/link";
import "./globals.css";

// Hors préfixe de langue (URL inconnue) : page minimale, en français.
export default function RootNotFound() {
  return (
    <html lang="fr">
      <body className="flex min-h-dvh items-center justify-center bg-bg p-6 text-center">
        <div>
          <p className="font-mono text-sm text-fg-muted">404</p>
          <h1 className="mt-2 text-xl font-semibold">Page introuvable</h1>
          <Link className="mt-4 inline-block text-sm text-primary underline" href="/">
            Retour à l’accueil
          </Link>
        </div>
      </body>
    </html>
  );
}
