import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ivory px-6 text-center">
      <div>
        <p className="eyebrow text-gold-deep">404</p>
        <h1 className="mt-3 text-4xl">Page not found</h1>
        <Link href="/" className="mt-6 inline-block border-b border-charcoal pb-0.5 text-sm">
          Return home
        </Link>
      </div>
    </main>
  );
}
