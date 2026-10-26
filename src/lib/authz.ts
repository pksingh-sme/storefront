import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type AdminActor = { id: string; email: string; name: string };

export class UnauthorizedError extends Error {
  constructor() {
    super("You must be signed in as an administrator.");
  }
}

export async function getAdmin(): Promise<AdminActor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

/** For server actions and route handlers: throws when the caller is not an administrator. */
export async function requireAdmin(): Promise<AdminActor> {
  const admin = await getAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}

/** For admin pages and layouts: redirects to the login page when not an administrator. */
export async function requireAdminPage(): Promise<AdminActor> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
