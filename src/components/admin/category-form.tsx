"use client";

import { useActionState, useState } from "react";
import { saveCategoryAction, type FormState } from "@/app/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { slugify } from "@/lib/slug";
import { MediaPicker } from "./media-picker";
import { keepValuesOnSubmit } from "./use-action-feedback";

type Initial = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  isActive: boolean;
  isFeatured: boolean;
  imageUrl: string | null;
  seoTitle: string;
  seoDescription: string;
};

export function CategoryForm({ categoryId, initial, parents, maxUploadMb }: { categoryId: string | null; initial: Initial; parents: { id: string; name: string }[]; maxUploadMb: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCategoryAction.bind(null, categoryId), null);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="grid gap-5 md:grid-cols-2" noValidate>
      {state ? (
        <Alert tone={state.ok ? "success" : "error"} className="md:col-span-2">
          {state.ok ? state.message : state.error}
        </Alert>
      ) : null}
      <Field name="name" label="Name" errors={errors?.name}>
        {(p) => <Input {...p} defaultValue={initial.name} required maxLength={80} onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))} />}
      </Field>
      <Field name="slug" label="URL slug" errors={errors?.slug}>
        {(p) => (
          <Input
            {...p}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
          />
        )}
      </Field>
      <Field name="parentId" label="Parent category" hint="Leave empty for a top-level category." errors={errors?.parentId}>
        {(p) => (
          <Select {...p} defaultValue={initial.parentId}>
            <option value="">None (top level)</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-col justify-end gap-2 pb-2">
        <Checkbox name="isActive" label="Active (visible in the store)" defaultChecked={initial.isActive} />
        <Checkbox name="isFeatured" label="Feature on the homepage" defaultChecked={initial.isFeatured} />
      </div>
      <Field name="description" label="Description" errors={errors?.description} className="md:col-span-2">
        {(p) => <Textarea {...p} defaultValue={initial.description} rows={3} maxLength={2000} />}
      </Field>
      <div className="md:col-span-2">
        <MediaPicker label="Category image" name="imageAssetId" removeName="removeImage" currentUrl={initial.imageUrl} maxUploadMb={maxUploadMb} />
      </div>
      <Field name="seoTitle" label="SEO title" errors={errors?.seoTitle}>
        {(p) => <Input {...p} defaultValue={initial.seoTitle} maxLength={70} />}
      </Field>
      <Field name="seoDescription" label="SEO description" errors={errors?.seoDescription}>
        {(p) => <Input {...p} defaultValue={initial.seoDescription} maxLength={170} />}
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save category"}
        </Button>
      </div>
    </form>
  );
}
