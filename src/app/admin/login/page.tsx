import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/authz";
import { getSettings } from "@/server/catalog";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  const settings = await getSettings();
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-4">
      <div className="w-full max-w-sm bg-ivory p-8 shadow-sm">
        <p className="eyebrow text-gold-deep">{settings.storeName}</p>
        <h1 className="mt-2 text-3xl">Admin sign in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
