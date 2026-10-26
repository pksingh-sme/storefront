import Link from "next/link";
import type { ProductCardDTO } from "@/server/dto";
import { Price } from "./price";

export function ProductCard({ product, priority }: { product: ProductCardDTO; priority?: boolean }) {
  const extraSwatches = product.swatches.length - 5;
  return (
    <article className="group relative" data-testid="product-card">
      <Link href={`/product/${product.slug}`} className="block focus-visible:outline-offset-4">
        <div className="relative aspect-[4/5] overflow-hidden bg-cream">
          {product.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.image.src}
              srcSet={product.image.srcSet}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              alt={product.image.alt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 size-full object-cover transition duration-700 ease-soft group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-stone">Image coming soon</div>
          )}
          {product.hoverImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.hoverImage.src}
              srcSet={product.hoverImage.srcSet}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover opacity-0 transition duration-700 ease-soft group-hover:opacity-100"
            />
          ) : null}
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {product.compareAtCents ? <span className="bg-ivory/95 px-2 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-danger">Sale</span> : null}
            {!product.inStock ? <span className="bg-ivory/95 px-2 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-stone">Sold out</span> : null}
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <p className="eyebrow text-stone">{product.categoryName}</p>
          <h3 className="font-display text-xl leading-tight group-hover:text-gold-deep">{product.name}</h3>
          <Price cents={product.priceCents} compareAtCents={product.compareAtCents} currency={product.currency} from={product.hasPriceRange} className="text-sm" />
        </div>
      </Link>
      {product.swatches.length > 1 ? (
        <ul className="mt-3 flex items-center gap-1.5" aria-label={`Available in ${product.swatches.length} colours`}>
          {product.swatches.slice(0, 5).map((s) => (
            <li key={s.name} title={s.name}>
              <span className="block size-3.5 rounded-full border border-charcoal/20" style={{ backgroundColor: s.hex ?? "#ddd" }} />
              <span className="sr-only">{s.name}</span>
            </li>
          ))}
          {extraSwatches > 0 ? <li className="text-xs text-stone">+{extraSwatches}</li> : null}
        </ul>
      ) : null}
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardDTO[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
