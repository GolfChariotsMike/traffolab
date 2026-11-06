import { serializeJsonLd, type JsonLdNode } from "@/lib/structured-data";

/** Server-rendered JSON-LD. A native script tag keeps it in the initial HTML. */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
