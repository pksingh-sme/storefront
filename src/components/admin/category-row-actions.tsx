"use client";

import { useState } from "react";
import { deleteCategoryAction, moveCategoryAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "./use-action-feedback";

export function CategoryRowActions({
  category,
  canMoveUp,
  canMoveDown,
  options,
}: {
  category: { id: string; name: string; productCount: number; childCount: number };
  canMoveUp: boolean;
  canMoveDown: boolean;
  options: { id: string; name: string }[];
}) {
  const { pending, feedback, run } = useActionRunner();
  const [deleting, setDeleting] = useState(false);
  const [target, setTarget] = useState("");

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1 text-sm">
        <button type="button" disabled={!canMoveUp || pending} onClick={() => run(() => moveCategoryAction(category.id, "up"))} className="px-2 disabled:opacity-30" aria-label={`Move ${category.name} up`}>
          ↑
        </button>
        <button type="button" disabled={!canMoveDown || pending} onClick={() => run(() => moveCategoryAction(category.id, "down"))} className="px-2 disabled:opacity-30" aria-label={`Move ${category.name} down`}>
          ↓
        </button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting((v) => !v)} aria-expanded={deleting}>
          Delete<span className="sr-only"> {category.name}</span>
        </Button>
      </div>
      {deleting ? (
        <div className="w-full max-w-sm border border-danger/30 bg-[#fbefef] p-3 text-sm">
          {category.childCount > 0 ? (
            <p>Move or delete its {category.childCount} subcategories first.</p>
          ) : (
            <>
              {category.productCount > 0 ? (
                <label className="block">
                  Move its {category.productCount} product(s) to:
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full border border-line bg-white px-2 py-1">
                    <option value="">Choose a category…</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p>This category is empty.</p>
              )}
              <Button
                size="sm"
                variant="danger"
                className="mt-2"
                disabled={pending || (category.productCount > 0 && !target)}
                onClick={() => run(() => deleteCategoryAction(category.id, target || null))}
              >
                Delete {category.name}
              </Button>
            </>
          )}
        </div>
      ) : null}
      {feedback?.tone === "error" ? (
        <p role="alert" className="text-sm text-danger">
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
