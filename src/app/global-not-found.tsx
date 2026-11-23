import type { Metadata } from "next";
import Link from "next/link";
import { baseMetadata, RootDocument } from "@/components/root-document";

export const metadata: Metadata = { ...baseMetadata, title: "Page not found" };

/** 404 for URLs that match no route (there are two root layouts, so no shared not-found). */
export default function GlobalNotFound() {
  return (
    <RootDocument>
      <main className="mx-auto flex max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <Link href="/" className="underline">
          Go to the home page
        </Link>
      </main>
    </RootDocument>
  );
}
