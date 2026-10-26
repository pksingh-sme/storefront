import { Card, PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadSettings } from "@/server/catalog";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await loadSettings();
  const raw = await prisma.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  return (
    <>
      <PageHeader title="Store settings" description="Branding, contact details, policies, shipping and tax." />
      <Card className="max-w-4xl">
        <SettingsForm
          maxUploadMb={env().MAX_UPLOAD_MB}
          initial={{ ...s, announcement: raw.announcement, announcementActive: raw.announcementActive }}
        />
      </Card>
    </>
  );
}
