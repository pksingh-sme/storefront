import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductGrid } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/section-heading";
import { getFeaturedCategories, getHomeCollections, getLiveBanners, getSettings } from "@/server/catalog";

export default async function HomePage() {
  const [settings, banners, categories, collections] = await Promise.all([
    getSettings(),
    getLiveBanners(),
    getFeaturedCategories(),
    getHomeCollections(),
  ]);
  const hero = banners.hero[0];
  const bestSellers = collections.bestSellers.length ? collections.bestSellers : collections.featured;

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative">
        <div className="relative min-h-[70svh] overflow-hidden bg-beige lg:min-h-[78vh]">
          {hero?.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={hero.imageUrl} alt={hero.altText ?? ""} fetchPriority="high" className="absolute inset-0 size-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-ink/55 via-ink/25 to-transparent" />
          <div className="container-page relative flex min-h-[70svh] items-end pb-16 lg:min-h-[78vh] lg:items-center lg:pb-0">
            <div className="max-w-xl text-ivory">
              <p className="eyebrow text-ivory/85">{settings.tagline ?? "New season"}</p>
              <h1 id="hero-title" className="mt-4 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
                {hero?.title ?? settings.storeName}
              </h1>
              {hero?.subtitle ? <p className="mt-5 max-w-md text-base text-ivory/90 sm:text-lg">{hero.subtitle}</p> : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={hero?.ctaHref ?? "/shop"} variant="gold" size="lg">
                  {hero?.ctaLabel ?? "Shop the collection"}
                </ButtonLink>
                <ButtonLink href="/shop?sort=newest" size="lg" className="border border-ivory/70 bg-transparent text-ivory hover:bg-ivory hover:text-charcoal">
                  New arrivals
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured categories */}
      {categories.length ? (
        <section aria-labelledby="categories-title" className="container-page py-20 lg:py-28">
          <SectionHeading eyebrow="Explore" title="Shop by category" id="categories-title" href="/shop" linkLabel="Shop all" />
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {categories.slice(0, 4).map((c, i) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-cream">
                    {c.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.imageUrl}
                        alt=""
                        loading={i < 2 ? "eager" : "lazy"}
                        className="absolute inset-0 size-full object-cover transition duration-700 ease-soft group-hover:scale-[1.04]"
                      />
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 to-transparent p-5 pt-16">
                      <h3 className="font-display text-2xl text-ivory sm:text-3xl">{c.name}</h3>
                      <span className="mt-1 inline-block text-xs uppercase tracking-[0.18em] text-ivory/85">Discover</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Best sellers */}
      {bestSellers.length ? (
        <section aria-labelledby="best-title" className="container-page pb-20 lg:pb-28">
          <SectionHeading
            eyebrow={collections.bestSellers.length ? "Most loved" : "Curated"}
            title={collections.bestSellers.length ? "Best sellers" : "Featured pieces"}
            id="best-title"
            href="/shop?sort=featured"
          />
          <ProductGrid products={bestSellers.slice(0, 4)} />
        </section>
      ) : null}

      {/* Promotional collections */}
      {banners.promo.length ? (
        <section aria-label="Collections" className="container-page pb-20 lg:pb-28">
          <ul className="grid gap-6 md:grid-cols-2">
            {banners.promo.slice(0, 2).map((b) => (
              <li key={b.id} className="group relative overflow-hidden bg-beige">
                <div className="relative aspect-[16/10]">
                  {b.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.imageUrl} alt={b.altText ?? ""} loading="lazy" className="absolute inset-0 size-full object-cover transition duration-700 ease-soft group-hover:scale-[1.03]" />
                  ) : null}
                  <div className="absolute inset-0 bg-ink/30" />
                  <div className="absolute inset-0 flex flex-col items-start justify-end p-6 text-ivory sm:p-10">
                    <h2 className="text-3xl sm:text-4xl">{b.title}</h2>
                    {b.subtitle ? <p className="mt-2 max-w-sm text-sm text-ivory/90">{b.subtitle}</p> : null}
                    {b.ctaHref ? (
                      <Link href={b.ctaHref} className="mt-5 border-b border-ivory pb-0.5 text-sm after:absolute after:inset-0">
                        {b.ctaLabel ?? "Explore"}
                        <span className="sr-only">: {b.title}</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* New arrivals */}
      {collections.newArrivals.length ? (
        <section aria-labelledby="new-title" className="container-page pb-20 lg:pb-28">
          <SectionHeading eyebrow="Just in" title="New arrivals" id="new-title" href="/shop?sort=newest" />
          <ProductGrid products={collections.newArrivals.slice(0, 8)} />
        </section>
      ) : null}

      {/* Brand story */}
      {settings.brandStory ? (
        <section aria-labelledby="story-title" className="bg-cream">
          <div className="container-page grid items-center gap-10 py-20 lg:grid-cols-12 lg:py-28">
            <div className="lg:col-span-5">
              <p className="eyebrow text-gold-deep">Our story</p>
              <h2 id="story-title" className="mt-3 text-4xl sm:text-5xl">
                {settings.brandStoryTitle ?? "Made with care"}
              </h2>
            </div>
            <div className="prose-store text-lg text-stone lg:col-span-6 lg:col-start-7">
              {settings.brandStory.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Newsletter */}
      <section aria-labelledby="newsletter-title" className="container-page py-20 text-center lg:py-28">
        <p className="eyebrow text-gold-deep">Stay in touch</p>
        <h2 id="newsletter-title" className="mt-3 text-4xl">
          Join our letter
        </h2>
        <p className="mx-auto mt-3 max-w-md text-stone">Be first to hear about new arrivals, restocks and private sales.</p>
        <NewsletterForm idPrefix="home" />
      </section>
    </>
  );
}
