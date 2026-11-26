import type { Metadata } from "next";
import { baseMetadata, RootDocument } from "@/components/root-document";
import { NotFoundContent } from "@/features/not-found/not-found-content";

// No title here: the page renders its own <title> in the URL's language (Next.js would put the
// metadata title back over it after hydration).
export const metadata: Metadata = { metadataBase: baseMetadata.metadataBase };

/** 404 for URLs that match no route (there are two root layouts, so no shared not-found). */
export default function GlobalNotFound() {
  return (
    <RootDocument locale="en">
      <NotFoundContent />
    </RootDocument>
  );
}
