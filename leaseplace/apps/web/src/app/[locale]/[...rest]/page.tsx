import { notFound } from "next/navigation";

// Toute URL inconnue sous une langue → page 404 traduite.
export default function CatchAll() {
  notFound();
}
