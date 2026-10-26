"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeCartItemAction, updateCartItemAction } from "@/app/(store)/actions";
import { colorParam } from "@/lib/gallery";
import { formatMoney } from "@/lib/money";
import type { CartLine } from "@/server/cart";

export function CartLines({ lines, currency }: { lines: CartLine[]; currency: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      router.refresh();
    });
  };

  return (
    <div aria-busy={pending}>
      {error ? (
        <p role="alert" className="mb-4 border border-danger/30 bg-[#fbefef] px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-line border-y border-line">
        {lines.map((line) => (
          <li key={line.id} className="flex gap-4 py-6 sm:gap-6" data-testid="cart-line" data-sku={line.sku}>
            <Link href={`/product/${line.productSlug}?color=${colorParam(line.colorName)}`} className="w-24 shrink-0 sm:w-28">
              {line.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={line.image.src} alt={line.image.alt} className="aspect-[4/5] w-full bg-cream object-cover" />
              ) : (
                <div className="aspect-[4/5] w-full bg-cream" />
              )}
            </Link>
            <div className="flex flex-1 flex-col">
              <div className="flex justify-between gap-4">
                <div>
                  <Link href={`/product/${line.productSlug}`} className="font-display text-xl hover:text-gold-deep">
                    {line.productName}
                  </Link>
                  <p className="mt-1 flex items-center gap-2 text-sm text-stone">
                    <span aria-hidden="true" className="size-3 rounded-full border border-charcoal/20" style={{ backgroundColor: line.colorHex ?? "#ddd" }} />
                    <span data-testid="cart-line-color">{line.colorName}</span>
                  </p>
                  <p className="mt-1 text-xs text-stone">SKU {line.sku}</p>
                </div>
                <p className="text-right text-sm" data-testid="cart-line-total">
                  {formatMoney(line.lineCents, currency)}
                  {line.quantity > 1 ? <span className="block text-xs text-stone">{formatMoney(line.unitCents, currency)} each</span> : null}
                </p>
              </div>
              {line.issue ? (
                <p className="mt-2 text-sm font-medium text-danger" data-testid="cart-line-issue">
                  {line.issue}
                </p>
              ) : null}
              <div className="mt-auto flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-stone">Qty</span>
                  <select
                    value={line.quantity}
                    disabled={pending}
                    onChange={(e) => run(() => updateCartItemAction(line.id, Number(e.target.value)))}
                    className="border border-line bg-white px-2 py-1"
                    aria-label={`Quantity for ${line.productName}, ${line.colorName}`}
                    data-testid="cart-line-quantity"
                  >
                    {Array.from({ length: Math.max(line.quantity, Math.min(Math.max(line.stock, 1), 10)) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeCartItemAction(line.id))}
                  className="text-sm underline underline-offset-4 hover:text-danger"
                >
                  Remove<span className="sr-only"> {line.productName}, {line.colorName}</span>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
