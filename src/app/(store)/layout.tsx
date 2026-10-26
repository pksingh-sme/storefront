import { cookies } from "next/headers";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { getCartCount, CART_COOKIE } from "@/server/cart";
import { getNavCategories, getSettings } from "@/server/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, cartToken] = await Promise.all([
    getSettings(),
    getNavCategories(),
    cookies().then((c) => c.get(CART_COOKIE)?.value),
  ]);
  const cartCount = await getCartCount(cartToken);
  return (
    <>
      <a href="#main" className="sr-only z-50 bg-charcoal px-4 py-2 text-ivory focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      {settings.announcement ? (
        <div className="bg-charcoal px-4 py-2 text-center text-xs tracking-[0.12em] text-ivory sm:text-[0.78rem]" role="region" aria-label="Announcement">
          {settings.announcement}
        </div>
      ) : null}
      <SiteHeader storeName={settings.storeName} logoUrl={settings.logoUrl} categories={categories} cartCount={cartCount} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter settings={settings} categories={categories} />
    </>
  );
}
