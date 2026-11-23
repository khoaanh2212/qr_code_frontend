import type { Metadata } from "next";
import Link from "next/link";
import { RequireSession } from "@/features/auth/require-session";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | QR Code Generator" },
};

/** The logged-in app. */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <header className="border-b border-black/10 dark:border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app" className="font-semibold">
            Dashboard
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <RequireSession>{children}</RequireSession>
      </main>
    </>
  );
}
