import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductExperience } from "@/components/product/product-experience";
import { Breadcrumbs } from "@/components/store/listing";
import { ProductGrid } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/section-heading";
import { colorParam, galleryForVariant, pickDefaultVariant } from "@/lib/gallery";
import { siteUrl } from "@/lib/env";
import { getPublishedProduct, getRelatedProducts, getSettings } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) return { title: "Product not found", robots: { index: false } };
  const lead = pickDefaultVariant(product.variants);
  const image = galleryForVariant(product.images, lead?.id ?? null)[0];
  const description = product.seoDescription ?? product.shortDescription ?? undefined;
  return {
    title: product.seoTitle ?? product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.seoTitle ?? product.name,
      description,
      url: `/product/${product.slug}`,
      images: image ? [{ url: image.src, alt: image.alt }] : undefined,
    },
  };
}

function absolute(url: string) {
  return url.startsWith("http") ? url : `${siteUrl()}${url}`;
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [product, settings, sp] = await Promise.all([getPublishedProduct(slug), getSettings(), searchParams]);
  if (!product) notFound();
  const related = await getRelatedProducts(product.id, product.category.id);
  const requested = typeof sp.color === "string" ? sp.color : typeof sp.variant === "string" ? sp.variant : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    url: absolute(`/product/${product.slug}`),
    productGroupID: product.id,
    variesBy: ["https://schema.org/color"],
    brand: { "@type": "Brand", name: settings.storeName },
    hasVariant: product.variants.map((v) => ({
      "@type": "Product",
      name: `${product.name} — ${v.colorName}`,
      sku: v.sku,
      color: v.colorName,
      image: galleryForVariant(product.images, v.id).slice(0, 3).map((i) => absolute(i.src)),
      offers: {
        "@type": "Offer",
        url: absolute(`/product/${product.slug}?color=${colorParam(v.colorName)}`),
        price: (v.unitCents / 100).toFixed(2),
        priceCurrency: product.currency,
        availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
      },
    })),
  };

  const crumbs = [
    { name: "Home", href: "/" },
    ...(product.category.parent ? [{ name: product.category.parent.name, href: `/category/${product.category.parent.slug}` }] : []),
    { name: product.category.name, href: `/category/${product.category.slug}` },
    { name: product.name },
  ];

  return (
    <div className="container-page py-8 lg:py-12">
      <script
        type="application/ld+json"
        // JSON.stringify output is escaped for "<" so product text cannot break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductExperience
        product={product}
        initialVariantId={requested}
        lowStockThreshold={settings.lowStockThreshold}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
      >
        <div className="mt-10 divide-y divide-line border-y border-line">
          {product.description ? (
            <details open className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                Description
                <span aria-hidden="true" className="transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="prose-store mt-4 text-sm text-stone">
                {product.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </details>
          ) : null}
          {product.specifications.length ? (
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                Details & specifications
                <span aria-hidden="true" className="transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <dl className="mt-4 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
                {product.specifications.map((s) => (
                  <div key={s.label} className="contents">
                    <dt className="text-stone">{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
          {settings.shippingPolicy || settings.returnsPolicy ? (
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                Shipping & returns
                <span aria-hidden="true" className="transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-4 space-y-3 text-sm text-stone">
                {settings.shippingPolicy ? <p className="line-clamp-4 whitespace-pre-line">{settings.shippingPolicy}</p> : null}
                {settings.returnsPolicy ? <p className="line-clamp-4 whitespace-pre-line">{settings.returnsPolicy}</p> : null}
              </div>
            </details>
          ) : null}
        </div>
      </ProductExperience>

      {related.length ? (
        <section aria-labelledby="related-title" className="mt-24">
          <SectionHeading eyebrow="You may also like" title="Related pieces" id="related-title" />
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  );
}
