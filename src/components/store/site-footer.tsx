import Link from "next/link";
import type { CategoryNode, StoreSettingsDTO } from "@/server/catalog";
import { NewsletterForm } from "./newsletter-form";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
};

export function SiteFooter({ settings, categories }: { settings: StoreSettingsDTO; categories: CategoryNode[] }) {
  const social = Object.entries(settings.socialLinks).filter(([, url]) => Boolean(url));
  return (
    <footer className="mt-24 border-t border-line bg-cream">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <p className="font-display text-2xl">{settings.storeName}</p>
          {settings.storeDescription ? <p className="mt-3 text-sm leading-relaxed text-stone">{settings.storeDescription}</p> : null}
          <address className="mt-5 space-y-1 text-sm not-italic text-stone">
            {settings.address ? <p>{settings.address}</p> : null}
            {settings.contactEmail ? (
              <p>
                <a className="hover:text-charcoal" href={`mailto:${settings.contactEmail}`}>
                  {settings.contactEmail}
                </a>
              </p>
            ) : null}
            {settings.contactPhone ? (
              <p>
                <a className="hover:text-charcoal" href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`}>
                  {settings.contactPhone}
                </a>
              </p>
            ) : null}
          </address>
        </div>

        <nav aria-label="Shop">
          <p className="eyebrow text-stone">Shop</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/shop" className="hover:text-gold-deep">
                All products
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="hover:text-gold-deep">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Customer care">
          <p className="eyebrow text-stone">Customer care</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/policies/shipping" className="hover:text-gold-deep">
                Shipping
              </Link>
            </li>
            <li>
              <Link href="/policies/returns" className="hover:text-gold-deep">
                Returns
              </Link>
            </li>
            <li>
              <Link href="/policies/privacy" className="hover:text-gold-deep">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-gold-deep">
                Shopping bag
              </Link>
            </li>
          </ul>
          {social.length ? (
            <>
              <p className="eyebrow mt-8 text-stone">Follow</p>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {social.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-gold-deep">
                      {SOCIAL_LABELS[key] ?? key}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>

        <div>
          <p className="eyebrow text-stone">Newsletter</p>
          <p className="mt-4 text-sm text-stone">New arrivals and private sales, a few times a season.</p>
          <NewsletterForm idPrefix="footer" compact />
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-6 text-xs text-stone">
          © {new Date().getFullYear()} {settings.storeName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
