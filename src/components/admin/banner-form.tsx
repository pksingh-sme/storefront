"use client";

import { useActionState } from "react";
import { saveBannerAction, type FormState } from "@/app/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { MediaPicker } from "./media-picker";
import { keepValuesOnSubmit } from "./use-action-feedback";

type Initial = {
  placement: "HERO" | "PROMO";
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  altText: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  imageUrl: string | null;
};

export function BannerForm({ bannerId, initial, maxUploadMb }: { bannerId: string | null; initial: Initial; maxUploadMb: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBannerAction.bind(null, bannerId), null);
  const e = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="grid gap-5 md:grid-cols-2" noValidate>
      {state ? (
        <Alert tone={state.ok ? "success" : "error"} className="md:col-span-2">
          {state.ok ? state.message : state.error}
        </Alert>
      ) : null}
      <Field name="placement" label="Placement" errors={e?.placement}>
        {(p) => (
          <Select {...p} defaultValue={initial.placement}>
            <option value="HERO">Hero (top of homepage)</option>
            <option value="PROMO">Promotional collection tile</option>
          </Select>
        )}
      </Field>
      <Field name="sortOrder" label="Display order" errors={e?.sortOrder}>
        {(p) => <Input {...p} type="number" defaultValue={initial.sortOrder} />}
      </Field>
      <Field name="title" label="Headline" errors={e?.title}>
        {(p) => <Input {...p} defaultValue={initial.title} required maxLength={120} />}
      </Field>
      <Field name="subtitle" label="Subheading" errors={e?.subtitle}>
        {(p) => <Input {...p} defaultValue={initial.subtitle} maxLength={300} />}
      </Field>
      <Field name="ctaLabel" label="Button label" errors={e?.ctaLabel}>
        {(p) => <Input {...p} defaultValue={initial.ctaLabel} maxLength={40} />}
      </Field>
      <Field name="ctaHref" label="Button link" hint="A path like /shop or /category/earrings, or a full https:// link." errors={e?.ctaHref}>
        {(p) => <Input {...p} defaultValue={initial.ctaHref} maxLength={500} />}
      </Field>
      <div className="md:col-span-2">
        <MediaPicker label="Banner image" name="imageAssetId" currentUrl={initial.imageUrl} maxUploadMb={maxUploadMb} />
      </div>
      <Field name="altText" label="Image description (alt text)" errors={e?.altText} className="md:col-span-2">
        {(p) => <Input {...p} defaultValue={initial.altText} maxLength={250} />}
      </Field>
      <Field name="startsAt" label="Show from" hint="Optional" errors={e?.startsAt}>
        {(p) => <Input {...p} type="datetime-local" defaultValue={initial.startsAt} />}
      </Field>
      <Field name="endsAt" label="Show until" hint="Optional" errors={e?.endsAt}>
        {(p) => <Input {...p} type="datetime-local" defaultValue={initial.endsAt} />}
      </Field>
      <Checkbox name="isActive" label="Active" defaultChecked={initial.isActive} />
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save banner"}
        </Button>
      </div>
    </form>
  );
}
