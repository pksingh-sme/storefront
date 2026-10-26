"use client";

import { useActionState } from "react";
import { createProductAction, type FormState } from "@/app/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { CategoryOptions, type CategoryOption } from "./category-options";
import { keepValuesOnSubmit } from "./use-action-feedback";

export function NewProductForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createProductAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="space-y-5" noValidate>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <Field name="name" label="Product name" errors={errors?.name}>
        {(p) => <Input {...p} required maxLength={160} />}
      </Field>
      <Field name="categoryId" label="Category" errors={errors?.categoryId}>
        {(p) => (
          <Select {...p} required defaultValue="">
            <option value="" disabled>
              Choose a category
            </option>
            <CategoryOptions categories={categories} />
          </Select>
        )}
      </Field>
      <Field name="basePrice" label="Base price" hint="Used for every colour unless a colour has its own price." errors={errors?.basePrice}>
        {(p) => <Input {...p} inputMode="decimal" placeholder="0.00" required />}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create draft"}
      </Button>
    </form>
  );
}
