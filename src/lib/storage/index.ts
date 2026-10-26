import "server-only";
import { env } from "@/lib/env";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";
import type { StorageDriver } from "./types";

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  driver =
    e.STORAGE_DRIVER === "s3"
      ? new S3StorageDriver({
          bucket: e.S3_BUCKET!,
          region: e.S3_REGION!,
          endpoint: e.S3_ENDPOINT,
          uploadEndpoint: e.S3_UPLOAD_ENDPOINT,
          forcePathStyle: e.S3_FORCE_PATH_STYLE === "true",
          accessKeyId: e.S3_ACCESS_KEY_ID,
          secretAccessKey: e.S3_SECRET_ACCESS_KEY,
          publicBaseUrl: e.S3_PUBLIC_BASE_URL!,
        })
      : new LocalStorageDriver(e.LOCAL_STORAGE_DIR, e.UPLOAD_SIGNING_SECRET!);
  return driver;
}

/** Test hook. */
export function setStorageDriver(next: StorageDriver | null) {
  driver = next;
}

export type { StorageDriver } from "./types";
