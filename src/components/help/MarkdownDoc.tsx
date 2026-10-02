/**
 * Rendu d'un document Markdown du dépôt (docs/*.md) sur le site : la page
 * publique affiche le document de référence LUI-MÊME, jamais une copie
 * réécrite (Phase 4 — méthodologie publique = docs/tco-methodologie.md).
 */
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const composants: Components = {
  h1: (p) => <h2 className="text-2xl font-bold mt-8 mb-3" {...p} />,
  h2: (p) => <h3 className="text-xl font-semibold mt-8 mb-3 border-b border-border pb-1" {...p} />,
  h3: (p) => <h4 className="text-lg font-semibold mt-6 mb-2" {...p} />,
  h4: (p) => <h5 className="font-semibold mt-4 mb-2" {...p} />,
  p: (p) => <p className="my-3 leading-relaxed" {...p} />,
  ul: (p) => <ul className="my-3 list-disc pl-6 space-y-1" {...p} />,
  ol: (p) => <ol className="my-3 list-decimal pl-6 space-y-1" {...p} />,
  blockquote: (p) => <blockquote className="my-4 border-l-4 border-primary/40 bg-muted/40 px-4 py-2 text-sm" {...p} />,
  code: (p) => <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...p} />,
  pre: (p) => <pre className="my-4 overflow-x-auto rounded-md bg-muted p-3 text-sm" {...p} />,
  table: (p) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse" {...p} />
    </div>
  ),
  th: (p) => <th className="border border-border bg-muted px-2 py-1 text-left font-semibold" {...p} />,
  td: (p) => <td className="border border-border px-2 py-1 align-top" {...p} />,
  a: (p) => <a className="text-primary underline" target="_blank" rel="noopener noreferrer" {...p} />,
  hr: () => <hr className="my-6 border-border" />,
};

export default function MarkdownDoc({ source }: { source: string }) {
  return (
    <div className="text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={composants}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
