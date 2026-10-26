"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { saveSettingsAction, type FormState } from "@/app/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { centsToInput } from "@/lib/money";
import type { StoreSettingsDTO } from "@/server/catalog";
import { MediaPicker } from "./media-picker";
import { keepValuesOnSubmit } from "./use-action-feedback";

type Initial = StoreSettingsDTO & { announcementActive: boolean };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-line pt-6 md:grid-cols-2">
      <legend className="mb-1 pr-3 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

const SOCIAL = ["instagram", "facebook", "pinterest", "tiktok", "x", "youtube"] as const;

export function SettingsForm({ initial, maxUploadMb }: { initial: Initial; maxUploadMb: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettingsAction, null);
  const e = state && !state.ok ? state.fieldErrors : undefined;
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="space-y-8" noValidate>
      {state ? <Alert tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Alert> : null}
      <Section title="Brand">
        <Field name="storeName" label="Store name" errors={e?.storeName}>
          {(p) => <Input {...p} defaultValue={initial.storeName} required maxLength={80} />}
        </Field>
        <Field name="tagline" label="Tagline" errors={e?.tagline}>
          {(p) => <Input {...p} defaultValue={initial.tagline ?? ""} maxLength={160} />}
        </Field>
        <div className="md:col-span-2">
          <MediaPicker label="Logo" name="logoAssetId" removeName="removeLogo" currentUrl={initial.logoUrl} maxUploadMb={maxUploadMb} />
        </div>
        <Field name="storeDescription" label="Short store description" hint="Used in the footer and search engine results." errors={e?.storeDescription} className="md:col-span-2">
          {(p) => <Textarea {...p} defaultValue={initial.storeDescription ?? ""} rows={2} maxLength={500} />}
        </Field>
        <Field name="brandStoryTitle" label="Brand story heading" errors={e?.brandStoryTitle}>
          {(p) => <Input {...p} defaultValue={initial.brandStoryTitle ?? ""} maxLength={120} />}
        </Field>
        <div />
        <Field name="brandStory" label="Brand story" hint="Shown on the homepage. Separate paragraphs with a blank line." errors={e?.brandStory} className="md:col-span-2">
          {(p) => <Textarea {...p} defaultValue={initial.brandStory ?? ""} rows={5} maxLength={4000} />}
        </Field>
      </Section>

      <Section title="Announcement bar">
        <Field name="announcement" label="Message" errors={e?.announcement}>
          {(p) => <Input {...p} defaultValue={initial.announcement ?? ""} maxLength={200} />}
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="announcementActive" label="Show announcement" defaultChecked={initial.announcementActive} />
        </div>
      </Section>

      <Section title="Contact">
        <Field name="contactEmail" label="Email" errors={e?.contactEmail}>
          {(p) => <Input {...p} type="email" defaultValue={initial.contactEmail ?? ""} />}
        </Field>
        <Field name="contactPhone" label="Phone" errors={e?.contactPhone}>
          {(p) => <Input {...p} defaultValue={initial.contactPhone ?? ""} maxLength={40} />}
        </Field>
        <Field name="address" label="Address" errors={e?.address} className="md:col-span-2">
          {(p) => <Input {...p} defaultValue={initial.address ?? ""} maxLength={300} />}
        </Field>
        {SOCIAL.map((k) => (
          <Field key={k} name={k} label={k === "x" ? "X (Twitter) URL" : `${k.charAt(0).toUpperCase()}${k.slice(1)} URL`} errors={e?.[k]}>
            {(p) => <Input {...p} type="url" defaultValue={initial.socialLinks[k] ?? ""} placeholder="https://" />}
          </Field>
        ))}
      </Section>

      <Section title="Pricing, shipping & tax">
        <Field name="currency" label="Currency" hint="3-letter code, e.g. USD, EUR, GBP, INR. Applies to all products." errors={e?.currency}>
          {(p) => <Input {...p} defaultValue={initial.currency} maxLength={3} className="uppercase" />}
        </Field>
        <Field name="lowStockThreshold" label="Low-stock warning at" hint="Colours with this many or fewer left are flagged." errors={e?.lowStockThreshold}>
          {(p) => <Input {...p} type="number" min={0} defaultValue={initial.lowStockThreshold} />}
        </Field>
        <Field name="flatShipping" label="Flat shipping rate" errors={e?.flatShipping}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={centsToInput(initial.flatShippingCents)} />}
        </Field>
        <Field name="freeShippingThreshold" label="Free shipping over" hint="Leave blank for no free shipping." errors={e?.freeShippingThreshold}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={centsToInput(initial.freeShippingThresholdCents)} />}
        </Field>
        <Field name="taxRatePercent" label="Tax rate (%)" hint="Simple flat rate added at checkout. Use 0 if prices include tax." errors={e?.taxRatePercent}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={(initial.taxRateBasisPoints / 100).toString()} />}
        </Field>
      </Section>

      <Section title="Policies">
        <Field name="shippingPolicy" label="Shipping policy" errors={e?.shippingPolicy} className="md:col-span-2">
          {(p) => <Textarea {...p} defaultValue={initial.shippingPolicy ?? ""} rows={5} />}
        </Field>
        <Field name="returnsPolicy" label="Returns policy" errors={e?.returnsPolicy} className="md:col-span-2">
          {(p) => <Textarea {...p} defaultValue={initial.returnsPolicy ?? ""} rows={5} />}
        </Field>
        <Field name="privacyPolicy" label="Privacy policy" errors={e?.privacyPolicy} className="md:col-span-2">
          {(p) => <Textarea {...p} defaultValue={initial.privacyPolicy ?? ""} rows={5} />}
        </Field>
      </Section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
