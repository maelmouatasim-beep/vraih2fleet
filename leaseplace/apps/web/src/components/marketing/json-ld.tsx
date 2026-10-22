/** Données structurées ; `<` échappé pour qu'aucun texte ne ferme la balise. */
export function JsonLd({ data, nonce }: { data: unknown; nonce?: string }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // JSON sérialisé et échappé : aucune balise ne peut être fermée par le contenu.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
