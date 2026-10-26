import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/authz";
import { getSettings } from "@/server/catalog";
import { AdminNav, SignOutButton } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const settings = await getSettings();
  return (
    <div className="min-h-dvh bg-[#f7f4ef] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-ivory lg:min-h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <Link href="/admin" className="font-display text-2xl">
            {settings.storeName}
          </Link>
          <p className="hidden text-xs text-stone lg:mt-1 lg:block">Store admin</p>
        </div>
        <AdminNav />
        <div className="hidden border-t border-line px-5 py-4 text-xs text-stone lg:block">
          <p className="truncate">{admin.email}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="underline underline-offset-4" target="_blank">
              View store
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
