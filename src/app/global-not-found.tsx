import type { Metadata } from "next";
import { baseMetadata, RootDocument } from "@/components/root-document";
import { NotFoundContent } from "@/features/not-found/not-found-content";
import { NOT_FOUND_MESSAGES } from "@/i18n/not-found";

export const metadata: Metadata = { ...baseMetadata, title: NOT_FOUND_MESSAGES.en.title };

/** 404 for URLs that match no route (there are two root layouts, so no shared not-found). */
export default function GlobalNotFound() {
  return (
    <RootDocument locale="en">
      <NotFoundContent />
    </RootDocument>
  );
}
