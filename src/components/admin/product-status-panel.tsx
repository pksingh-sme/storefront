"use client";

import { useRouter } from "next/navigation";
import { deleteProductAction, duplicateProductAction, setProductStatusAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ProductStatus } from "@/generated/prisma/client";
import { Card } from "./page-header";
import { useActionRunner } from "./use-action-feedback";

export function ProductStatusPanel({ productId, status, slug, name, issues }: { productId: string; status: ProductStatus; slug: string; name: string; issues: string[] }) {
  const router = useRouter();
  const { pending, feedback, run } = useActionRunner();

  return (
    <Card title="Visibility" className="xl:sticky xl:top-6">
      <p className="text-sm">
        Status: <strong data-testid="product-status">{status === "PUBLISHED" ? "Published" : status === "DRAFT" ? "Draft" : "Archived"}</strong>
      </p>
      <p className="mt-1 text-xs text-stone">Only published products are visible to customers.</p>

      {issues.length && status !== "PUBLISHED" ? (
        <div className="mt-4 border border-warning/30 bg-[#fbf3e6] p-3 text-sm text-warning">
          <p className="font-medium">Before publishing:</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback ? (
        <Alert tone={feedback.tone === "success" ? "success" : "error"} className="mt-4">
          {feedback.text}
        </Alert>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        {status !== "PUBLISHED" ? (
          <Button onClick={() => run(() => setProductStatusAction(productId, "PUBLISHED"))} disabled={pending} data-testid="publish-button">
            Publish
          </Button>
        ) : (
          <>
            <a href={`/product/${slug}`} target="_blank" rel="noreferrer" className="text-center text-sm underline underline-offset-4">
              View on store
            </a>
            <Button variant="secondary" onClick={() => run(() => setProductStatusAction(productId, "DRAFT"))} disabled={pending} data-testid="unpublish-button">
              Unpublish
            </Button>
          </>
        )}
        {status !== "ARCHIVED" ? (
          <Button variant="ghost" onClick={() => run(() => setProductStatusAction(productId, "ARCHIVED"))} disabled={pending}>
            Archive
          </Button>
        ) : null}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await duplicateProductAction(productId);
              if (r.ok && r.data) router.push(`/admin/products/${r.data.id}`);
              return r;
            })
          }
        >
          Duplicate
        </Button>
        <Button
          variant="ghost"
          className="text-danger hover:bg-[#fbefef]"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete "${name}" permanently? This removes its colours and images. Past orders keep their records.`)) return;
            run(
              () => deleteProductAction(productId),
              () => router.push("/admin/products"),
            );
          }}
        >
          Delete product
        </Button>
      </div>
    </Card>
  );
}
