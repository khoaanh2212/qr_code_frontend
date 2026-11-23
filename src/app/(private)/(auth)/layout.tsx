import Link from "next/link";

/** Auth pages: login, sign-up, email verification, password reset. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="font-semibold">
        QR Code Generator
      </Link>
      {children}
    </main>
  );
}
