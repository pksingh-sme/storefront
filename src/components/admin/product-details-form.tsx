"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { updateProductAction, type FormState } from "@/app/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { centsToInput } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { CategoryOptions, type CategoryOption } from "./category-options";
import { keepValuesOnSubmit } from "./use-action-feedback";

type Initial = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  basePriceCents: number;
  salePriceCents: number | null;
  isFeatured: boolean;
  sortOrder: number;
  specifications: string;
  seoTitle: string;
  seoDescription: string;
  currency: string;
};

export function ProductDetailsForm({ productId, initial, categories }: { productId: string; initial: Initial; categories: CategoryOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(updateProductAction.bind(null, productId), null);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(false);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="grid gap-5 md:grid-cols-2" noValidate>
      {state ? (
        <Alert tone={state.ok ? "success" : "error"} className="md:col-span-2">
          {state.ok ? state.message : state.error}
        </Alert>
      ) : null}
      <Field name="name" label="Name" errors={errors?.name}>
        {(p) => (
          <Input
            {...p}
            defaultValue={initial.name}
            required
            maxLength={160}
            onChange={(e) => {
              if (!slugTouched && initial.slug === slugify(initial.name)) setSlug(slugify(e.target.value));
            }}
          />
        )}
      </Field>
      <Field name="slug" label="URL slug" hint="Lowercase words separated by hyphens. Changing it changes the product URL." errors={errors?.slug}>
        {(p) => (
          <Input
            {...p}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
            maxLength={80}
          />
        )}
      </Field>
      <Field name="categoryId" label="Category" errors={errors?.categoryId}>
        {(p) => (
          <Select {...p} defaultValue={initial.categoryId}>
            <CategoryOptions categories={categories} />
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field name="basePrice" label={`Base price (${initial.currency})`} errors={errors?.basePrice}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={centsToInput(initial.basePriceCents)} required />}
        </Field>
        <Field name="salePrice" label="Sale price" hint="Optional" errors={errors?.salePrice}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={centsToInput(initial.salePriceCents)} />}
        </Field>
      </div>
      <Field name="shortDescription" label="Short description" hint="Shown near the price. Up to 300 characters." errors={errors?.shortDescription} className="md:col-span-2">
        {(p) => <Textarea {...p} defaultValue={initial.shortDescription} maxLength={300} rows={2} />}
      </Field>
      <Field name="description" label="Full description" hint="Separate paragraphs with a blank line." errors={errors?.description} className="md:col-span-2">
        {(p) => <Textarea {...p} defaultValue={initial.description} rows={6} maxLength={10000} />}
      </Field>
      <Field name="specifications" label="Specifications" hint='One per line, as "Label: Value", e.g. "Material: Pashmina".' errors={errors?.specifications} className="md:col-span-2">
        {(p) => <Textarea {...p} defaultValue={initial.specifications} rows={4} />}
      </Field>
      <Field name="seoTitle" label="SEO title" hint="Optional. Up to 70 characters; defaults to the product name." errors={errors?.seoTitle}>
        {(p) => <Input {...p} defaultValue={initial.seoTitle} maxLength={70} />}
      </Field>
      <Field name="seoDescription" label="SEO description" hint="Optional. Up to 170 characters." errors={errors?.seoDescription}>
        {(p) => <Input {...p} defaultValue={initial.seoDescription} maxLength={170} />}
      </Field>
      <div className="flex flex-wrap items-end gap-6">
        <Checkbox name="isFeatured" label="Featured on the homepage" defaultChecked={initial.isFeatured} />
        <Field name="sortOrder" label="Display order" hint="Lower numbers appear first.">
          {(p) => <Input {...p} type="number" defaultValue={initial.sortOrder} className="w-28" />}
        </Field>
      </div>
      <div className="flex items-end justify-end md:col-span-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </form>
  );
}
