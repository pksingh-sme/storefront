"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { addToCartAction } from "@/app/(store)/actions";
import { Price } from "@/components/store/price";
import { colorParam, galleryForVariant, pickDefaultVariant, stockState } from "@/lib/gallery";
import { cn } from "@/lib/cn";
import type { ProductDetailDTO } from "@/server/catalog";
import { ProductGallery } from "./product-gallery";
import { VariantSwatches } from "./variant-swatches";

type Props = {
  product: ProductDetailDTO;
  initialVariantId?: string | null;
  lowStockThreshold?: number;
  /** "preview" renders the admin preview: no cart, no URL updates, inactive colours visible. */
  mode?: "store" | "preview";
  breadcrumbs?: ReactNode;
  children?: ReactNode;
};

export function ProductExperience({ product, initialVariantId, lowStockThreshold = 3, mode = "store", breadcrumbs, children }: Props) {
  const router = useRouter();
  const [variantId, setVariantId] = useState<string | null>(
    () => pickDefaultVariant(product.variants, initialVariantId)?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const images = useMemo(() => galleryForVariant(product.images, variantId), [product.images, variantId]);
  const stock = variant ? stockState(variant.stock, lowStockThreshold) : { kind: "out" as const };
  const maxQty = variant ? Math.max(1, Math.min(variant.stock, 10)) : 1;
  const canBuy = mode === "store" && variant != null && variant.stock > 0;

  const selectVariant = (id: string) => {
    if (id === variantId) return;
    setVariantId(id);
    setQuantity(1);
    setMessage(null);
    const v = product.variants.find((x) => x.id === id);
    if (mode === "store" && v) {
      const url = new URL(window.location.href);
      url.searchParams.set("color", colorParam(v.colorName));
      window.history.replaceState(window.history.state, "", url);
    }
  };

  const addToBag = () => {
    if (!variant || !canBuy) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addToCartAction(variant.id, quantity);
      if (result.ok) {
        setMessage({ tone: "success", text: `Added ${quantity} × ${product.name} (${variant.colorName}) to your bag.` });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-7">
        <ProductGallery
          key={variantId ?? "shared"}
          images={images}
          label={variant ? `${product.name} in ${variant.colorName}` : product.name}
        />
      </div>

      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-28">
          {breadcrumbs}
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{product.name}</h1>

          <div className="mt-4 text-xl" data-testid="product-price" aria-live="polite">
            {variant ? <Price cents={variant.unitCents} compareAtCents={variant.saleCents != null ? variant.regularCents : null} currency={product.currency} /> : null}
          </div>

          {product.shortDescription ? <p className="mt-5 leading-relaxed text-stone">{product.shortDescription}</p> : null}

          <div className="mt-8 space-y-6 border-t border-line pt-8">
            {product.variants.length > 0 ? (
              <VariantSwatches options={product.variants} selectedId={variantId} onSelect={selectVariant} />
            ) : (
              <p className="text-sm text-stone">This product has no colours configured yet.</p>
            )}

            {variant ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-stone">SKU</dt>
                <dd data-testid="variant-sku">{variant.sku}</dd>
                <dt className="text-stone">Availability</dt>
                <dd
                  data-testid="variant-stock"
                  className={cn(stock.kind === "out" && "font-medium text-danger", stock.kind === "low" && "text-warning")}
                >
                  {stock.kind === "out" ? "Out of stock" : stock.kind === "low" ? `Only ${stock.remaining} left` : "In stock"}
                </dd>
              </dl>
            ) : null}

            {mode === "store" ? (
              <div className="flex flex-wrap items-stretch gap-3">
                <div className="flex items-center border border-charcoal/40" role="group" aria-label="Quantity">
                  <button
                    type="button"
                    className="grid h-12 w-11 place-items-center text-lg disabled:opacity-40"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={!canBuy || quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <label htmlFor="quantity" className="sr-only">
                    Quantity
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxQty}
                    value={quantity}
                    disabled={!canBuy}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setQuantity(Number.isNaN(n) ? 1 : Math.min(Math.max(n, 1), maxQty));
                    }}
                    className="h-12 w-12 border-0 bg-transparent text-center [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    className="grid h-12 w-11 place-items-center text-lg disabled:opacity-40"
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    disabled={!canBuy || quantity >= maxQty}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addToBag}
                  disabled={!canBuy || pending}
                  data-testid="add-to-cart"
                  className="h-12 flex-1 bg-charcoal px-6 text-sm font-medium tracking-[0.12em] text-ivory uppercase transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-stone/50"
                >
                  {!variant || variant.stock <= 0 ? "Out of stock" : pending ? "Adding…" : "Add to bag"}
                </button>
              </div>
            ) : (
              <p className="border border-dashed border-gold px-4 py-3 text-sm text-gold-deep">Preview — this is how customers will see the gallery and colour selector.</p>
            )}

            <div aria-live="polite" className="min-h-6">
              {message ? (
                <p className={cn("text-sm", message.tone === "success" ? "text-success" : "text-danger")} data-testid="cart-message">
                  {message.text}{" "}
                  {message.tone === "success" ? (
                    <Link href="/cart" className="underline underline-offset-4">
                      View bag
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
