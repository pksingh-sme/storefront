"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProductAction, duplicateProductAction, setProductStatusAction } from "@/app/admin/actions";
import type { ProductStatus } from "@/generated/prisma/client";

export function ProductRowActions({ productId, status, slug, name }: { productId: string; status: ProductStatus; slug: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, onOk?: (data: unknown) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
      else onOk?.(r.data);
      router.refresh();
    });

  return (
    <div className="flex items-center justify-end gap-3 text-xs" aria-busy={pending}>
      <Link href={`/admin/products/${productId}`} className="underline underline-offset-4">
        Edit<span className="sr-only"> {name}</span>
      </Link>
      {status === "PUBLISHED" ? (
        <>
          <a href={`/product/${slug}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            View
          </a>
          <button type="button" disabled={pending} onClick={() => run(() => setProductStatusAction(productId, "DRAFT"))} className="underline underline-offset-4">
            Unpublish
          </button>
        </>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => setProductStatusAction(productId, "PUBLISHED"))} className="underline underline-offset-4">
          Publish
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => duplicateProductAction(productId), (d) => router.push(`/admin/products/${(d as { id: string }).id}`))}
        className="underline underline-offset-4"
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${name}" permanently? Its images will be removed. Past orders keep their records.`)) run(() => deleteProductAction(productId));
        }}
        className="text-danger underline underline-offset-4"
      >
        Delete
      </button>
    </div>
  );
}
