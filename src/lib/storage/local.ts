import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { signUploadToken } from "./signing";
import type { StorageDriver } from "./types";

/**
 * Development storage driver that keeps files on the local disk and serves them from
 * /media. Uploads go to a signed, expiring endpoint on this server, mirroring the
 * presigned-POST flow used with S3. Not suitable for multi-instance production.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  constructor(
    private readonly rootDir: string,
    private readonly signingSecret: string,
  ) {}

  resolve(key: string): string {
    const root = path.resolve(this.rootDir);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async createUpload(key: string, contentType: string, maxBytes: number) {
    const exp = Date.now() + 5 * 60 * 1000;
    const token = signUploadToken({ key, contentType, maxBytes, exp }, this.signingSecret);
    return { url: "/api/uploads/local", fields: { token }, expiresAt: new Date(exp).toISOString() };
  }

  async getObject(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async putObject(key: string, body: Buffer) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async deleteObjects(keys: string[]) {
    await Promise.all(keys.map((k) => unlink(this.resolve(k)).catch(() => undefined)));
  }

  async deletePrefix(prefix: string) {
    await rm(this.resolve(prefix.replace(/\/$/, "")), { recursive: true, force: true });
  }

  publicUrl(key: string) {
    return `/media/${key}`;
  }
}
