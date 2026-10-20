/**
 * Storage driver contract. Every backend (local FS, Cloudflare R2, S3) speaks
 * the same three verbs — save, read, delete — plus URL <-> key helpers.
 *
 * Keys are POSIX-style relative paths like "products/2026-10/abc.jpg". They
 * never start with a slash and never contain "..".
 */
export interface StoredFile {
  key: string;
  url: string;
  size: number;
}

export interface StorageDriver {
  /** Human-readable name for logs and health checks. */
  readonly kind: 'local' | 'r2';

  /** True when this driver serves files from the API's own origin (needs
   *  express.static). False for cloud drivers whose URLs point elsewhere. */
  readonly servesStatic: boolean;

  save(
    prefix: string,
    buffer: Buffer,
    mime: string,
    originalName?: string,
  ): Promise<StoredFile>;

  read(key: string): Promise<Buffer>;

  delete(key: string): Promise<void>;

  /** Absolute URL for a stored key. */
  publicUrl(key: string): string;

  /** Reverse of publicUrl — extract the key from a URL this driver produced. */
  extractKey(url: string): string | null;

  /** Local FS root, only meaningful for the local driver (returns '' for R2). */
  getRoot?(): string;
}
