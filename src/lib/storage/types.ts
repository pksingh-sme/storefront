export type PresignedUpload = {
  /** URL the browser sends a multipart/form-data POST to. */
  url: string;
  /** Form fields that must be sent before the `file` field. */
  fields: Record<string, string>;
  expiresAt: string;
};

export interface StorageDriver {
  readonly name: "local" | "s3";
  /** Creates a short-lived, single-object upload target restricted to one content type and a maximum size. */
  createUpload(key: string, contentType: string, maxBytes: number): Promise<PresignedUpload>;
  getObject(key: string): Promise<Buffer | null>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  publicUrl(key: string): string;
}
