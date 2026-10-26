// Creates (or resets the password of) a store administrator.
//
//   npm run admin:create -- --email owner@example.com --name "Store Owner"
//
// The password is read from the ADMIN_PASSWORD environment variable if set, otherwise
// you are prompted for it (input is hidden). There is no default password.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";

const MIN_LENGTH = 12;

function promptHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" }, "reset-password": { type: "boolean", default: false } },
  });
  const email = z.email().safeParse(values.email?.trim().toLowerCase());
  if (!email.success) throw new Error('Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--reset-password]');

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (!process.stdin.isTTY) throw new Error("Set ADMIN_PASSWORD or run in an interactive terminal.");
    password = await promptHidden(`Password for ${email.data} (min ${MIN_LENGTH} characters): `);
    const confirm = await promptHidden("Confirm password: ");
    if (password !== confirm) throw new Error("Passwords do not match.");
  }
  if (password.length < MIN_LENGTH) throw new Error(`Password must be at least ${MIN_LENGTH} characters.`);
  if (password.length > 128) throw new Error("Password must be at most 128 characters.");

  const hash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email: email.data }, include: { accounts: true } });

  if (existing) {
    if (!values["reset-password"]) throw new Error("That user already exists. Pass --reset-password to set a new password.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: existing.id }, data: { role: "admin", ...(values.name ? { name: values.name } : {}) } });
      const credential = existing.accounts.find((a) => a.providerId === "credential");
      if (credential) await tx.account.update({ where: { id: credential.id }, data: { password: hash } });
      else await tx.account.create({ data: { id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: hash } });
      // Sign out existing sessions after a password reset.
      await tx.session.deleteMany({ where: { userId: existing.id } });
      await tx.auditLog.create({ data: { actorId: null, action: "admin.password_reset", entityType: "User", entityId: existing.id } });
    });
    console.log(`Password reset for ${email.data}.`);
    return;
  }

  const userId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: { id: userId, email: email.data, name: values.name?.trim() || "Store Admin", emailVerified: true, role: "admin" },
    });
    await tx.account.create({ data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hash } });
    await tx.auditLog.create({ data: { actorId: null, action: "admin.create", entityType: "User", entityId: userId } });
  });
  console.log(`Administrator ${email.data} created. Sign in at /admin/login.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
