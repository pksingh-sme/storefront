import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/server/catalog";

const POLICIES = {
  shipping: { title: "Shipping policy", field: "shippingPolicy" },
  returns: { title: "Returns policy", field: "returnsPolicy" },
  privacy: { title: "Privacy policy", field: "privacyPolicy" },
} as const;

type Props = { params: Promise<{ policy: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { policy } = await params;
  const def = POLICIES[policy as keyof typeof POLICIES];
  return def ? { title: def.title, alternates: { canonical: `/policies/${policy}` } } : { title: "Not found" };
}

export default async function PolicyPage({ params }: Props) {
  const { policy } = await params;
  const def = POLICIES[policy as keyof typeof POLICIES];
  if (!def) notFound();
  const settings = await getSettings();
  const text = settings[def.field];
  return (
    <article className="container-page max-w-3xl py-14 lg:py-20">
      <h1 className="text-4xl sm:text-5xl">{def.title}</h1>
      <div className="prose-store mt-8 whitespace-pre-line text-stone">
        {text ?? "This policy hasn't been published yet. Please contact us with any questions."}
      </div>
    </article>
  );
}
