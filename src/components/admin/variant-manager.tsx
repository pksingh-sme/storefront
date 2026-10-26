"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  createVariantAction,
  deleteVariantAction,
  reorderVariantsAction,
  updateVariantAction,
  type FormState,
} from "@/app/admin/actions";
import { Alert, Badge } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { centsToInput, formatMoney } from "@/lib/money";
import { keepValuesOnSubmit, useActionRunner } from "./use-action-feedback";

export type AdminVariant = {
  id: string;
  colorName: string;
  colorHex: string | null;
  sku: string;
  priceCents: number | null;
  salePriceCents: number | null;
  stock: number;
  isActive: boolean;
  orderCount: number;
};

function VariantFields({ prefix, initial, errors }: { prefix: string; initial?: Partial<AdminVariant>; errors?: Record<string, string[] | undefined> }) {
  const [hex, setHex] = useState(initial?.colorHex ?? "#C8B89A");
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Field idPrefix={prefix} name="colorName" label="Colour name" errors={errors?.colorName} className="lg:col-span-2">
        {(p) => <Input {...p} defaultValue={initial?.colorName} required maxLength={60} placeholder="e.g. Burgundy" />}
      </Field>
      <div>
        <label htmlFor={`${prefix}-colorHex`} className="mb-1.5 block text-sm font-medium">
          Swatch
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Pick swatch colour"
            value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#C8B89A"}
            onChange={(e) => setHex(e.target.value.toUpperCase())}
            className="h-10 w-10 cursor-pointer border border-line bg-white p-0.5"
          />
          <Input
           
            name="colorHex"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            maxLength={7}
            aria-invalid={errors?.colorHex ? true : undefined}
            className="w-24"
          />
        </div>
        {errors?.colorHex ? <p className="mt-1 text-sm text-danger">{errors.colorHex[0]}</p> : null}
      </div>
      <Field idPrefix={prefix} name="sku" label="SKU" errors={errors?.sku} className="lg:col-span-2">
        {(p) => <Input {...p} defaultValue={initial?.sku} required maxLength={64} className="uppercase" />}
      </Field>
      <Field idPrefix={prefix} name="stock" label="Stock" errors={errors?.stock}>
        {(p) => <Input {...p} type="number" min={0} step={1} defaultValue={initial?.stock ?? 0} required />}
      </Field>
      <Field idPrefix={prefix} name="price" label="Price override" hint="Blank = product price" errors={errors?.price} className="lg:col-span-2">
        {(p) => <Input {...p} inputMode="decimal" defaultValue={centsToInput(initial?.priceCents)} />}
      </Field>
      <Field idPrefix={prefix} name="salePrice" label="Sale price" hint="Optional" errors={errors?.salePrice} className="lg:col-span-2">
        {(p) => <Input {...p} inputMode="decimal" defaultValue={centsToInput(initial?.salePriceCents)} />}
      </Field>
      <div className="flex items-end pb-2 lg:col-span-2">
        <Checkbox name="isActive" label="Visible to customers" defaultChecked={initial?.isActive ?? true} />
      </div>
    </div>
  );
}

function VariantRow({ variant, index, count, currency, onMove }: { variant: AdminVariant; index: number; count: number; currency: string; onMove: (dir: -1 | 1) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(updateVariantAction.bind(null, variant.id), null);
  const { pending: deleting, feedback, run } = useActionRunner();
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const remove = () => {
    const warning =
      variant.orderCount > 0
        ? `"${variant.colorName}" appears in ${variant.orderCount} past order(s). Order history will be kept, but the colour and its images will be removed. Consider unticking "Visible to customers" instead.\n\nDelete anyway?`
        : `Delete the colour "${variant.colorName}" and all of its images?`;
    if (confirm(warning)) run(() => deleteVariantAction(variant.id, variant.orderCount > 0));
  };

  return (
    <li className="border border-line" data-testid="variant-row" data-color={variant.colorName}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span aria-hidden="true" className="size-6 rounded-full border border-charcoal/20" style={{ backgroundColor: variant.colorHex ?? "#ddd" }} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {variant.colorName} {!variant.isActive ? <Badge>hidden</Badge> : null}
          </p>
          <p className="text-xs text-stone">
            {variant.sku} · {variant.priceCents != null ? formatMoney(variant.priceCents, currency) : "product price"}
            {variant.salePriceCents != null ? ` · sale ${formatMoney(variant.salePriceCents, currency)}` : ""}
          </p>
        </div>
        {variant.stock === 0 ? <Badge tone="danger">Out of stock</Badge> : <Badge>{variant.stock} in stock</Badge>}
        <div className="flex items-center gap-1">
          <button type="button" className="px-2 py-1 text-sm disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${variant.colorName} up`}>
            ↑
          </button>
          <button type="button" className="px-2 py-1 text-sm disabled:opacity-30" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${variant.colorName} down`}>
            ↓
          </button>
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Close" : "Edit"}
            <span className="sr-only"> {variant.colorName}</span>
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" disabled={deleting} onClick={remove}>
            Delete<span className="sr-only"> {variant.colorName}</span>
          </Button>
        </div>
      </div>
      {feedback?.tone === "error" ? (
        <Alert tone="error" className="mx-4 mb-3">
          {feedback.text}
        </Alert>
      ) : null}
      {open ? (
        <form onSubmit={keepValuesOnSubmit(action)} className="space-y-4 border-t border-line bg-ivory p-4" noValidate>
          {state ? <Alert tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Alert> : null}
          <VariantFields prefix={`v-${variant.id}`} initial={variant} errors={errors} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save colour"}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

function NewVariantForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(createVariantAction.bind(null, productId), null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  // Clear the form after a successful add.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setFormKey((k) => k + 1);
  }

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form key={formKey} onSubmit={keepValuesOnSubmit(action)} className="space-y-4 border border-dashed border-sand bg-ivory p-4" noValidate aria-label="Add a colour">
      <p className="text-sm font-medium">Add a colour</p>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
      <VariantFields prefix="new-variant" errors={errors} />
      <Button type="submit" size="sm" disabled={pending} data-testid="add-variant">
        {pending ? "Adding…" : "Add colour"}
      </Button>
    </form>
  );
}

export function VariantManager({ productId, variants, currency }: { productId: string; variants: AdminVariant[]; currency: string }) {
  const { feedback, run } = useActionRunner();
  const move = (index: number, dir: -1 | 1) => {
    const ids = variants.map((v) => v.id);
    const target = index + dir;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderVariantsAction(productId, ids));
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone">Each colour has its own SKU, stock, optional price and its own image gallery. The first colour in stock is shown first to customers.</p>
      {feedback?.tone === "error" ? <Alert tone="error">{feedback.text}</Alert> : null}
      {variants.length ? (
        <ul className="space-y-2">
          {variants.map((v, i) => (
            <VariantRow key={v.id} variant={v} index={i} count={variants.length} currency={currency} onMove={(dir) => move(i, dir)} />
          ))}
        </ul>
      ) : (
        <p className="text-sm">No colours yet. Add at least one before publishing.</p>
      )}
      <NewVariantForm productId={productId} />
    </div>
  );
}
