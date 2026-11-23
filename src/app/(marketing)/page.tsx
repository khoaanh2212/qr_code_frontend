export default function HomePage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Free QR code generator</h1>
      <p className="max-w-prose text-black/70 dark:text-white/70">
        Create QR codes for links, text, Wi-Fi, contacts, email, SMS and phone numbers. No account
        needed.
      </p>
      {/* The generator (features/qr-editor) goes here. */}
    </section>
  );
}
