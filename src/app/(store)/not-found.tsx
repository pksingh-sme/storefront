import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <p className="eyebrow text-gold-deep">404</p>
      <h1 className="mt-3 text-4xl sm:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mt-4 text-stone">The piece you&apos;re looking for may have sold out or moved.</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/shop">Browse the shop</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
