import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { StorageDriver } from "./types";

export type S3Config = {
  bucket: string;
  region: string;
  endpoint?: string;
  /** Browser-facing endpoint for presigned uploads when it differs from `endpoint` (e.g. MinIO in Docker). */
  uploadEndpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl: string;
};

/**
 * S3-compatible storage. Credentials stay on the server; browsers only receive
 * presigned POST policies that expire after five minutes and allow exactly one key,
 * one content type and a bounded size.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  private readonly client: S3Client;
  private readonly presignClient: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = this.makeClient(config.endpoint);
    // POST policies are not bound to a host, so presigning against another endpoint is safe.
    this.presignClient = config.uploadEndpoint ? this.makeClient(config.uploadEndpoint) : this.client;
  }

  private makeClient(endpoint: string | undefined) {
    const config = this.config;
    return new S3Client({
      region: config.region,
      endpoint,
      forcePathStyle: config.forcePathStyle,
      // When keys are not provided the SDK falls back to the default provider chain
      // (IAM role, instance profile, etc.), which is preferred in production.
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });
  }

  async createUpload(key: string, contentType: string, maxBytes: number) {
    const expires = 300;
    const { url, fields } = await createPresignedPost(this.presignClient, {
      Bucket: this.config.bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 1, maxBytes],
        ["eq", "$Content-Type", contentType],
      ],
      Fields: { "Content-Type": contentType },
      Expires: expires,
    });
    return { url, fields, expiresAt: new Date(Date.now() + expires * 1000).toISOString() };
  }

  async getObject(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async deleteObjects(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      if (chunk.length === 0) continue;
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  async deletePrefix(prefix: string) {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.config.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      await this.deleteObjects((page.Contents ?? []).map((o) => o.Key!).filter(Boolean));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  publicUrl(key: string) {
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
}
