import Link from "next/link";
import { baseMetadata, RootDocument } from "@/components/root-document";

export const metadata = baseMetadata;

/**
 * Root layout of the public pages: prerendered and cached at the CDN, indexed by search engines.
 * Rules (see README): no user-supplied content, only `publicApi` (no cookies). Links into the
 * private pages are full page loads because they use the other root layout.
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <RootDocument>
      <header className="border-b border-black/10 dark:border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold">
            QR Code Generator
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/login">Log in</Link>
            <Link href="/register">Sign up</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-black/10 py-6 text-center text-sm text-black/60 dark:border-white/10 dark:text-white/60">
        Static QR codes are yours and keep working forever.
      </footer>
    </RootDocument>
  );
}
