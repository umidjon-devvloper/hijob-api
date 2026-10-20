import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageDriver, StoredFile } from './storage.types';
import { extForMime, sanitisePrefix } from './helpers';

/**
 * Cloudflare R2 driver — S3-compatible, no egress fees, ~30 ms latency to
 * Tashkent. Public reads are served from R2_PUBLIC_URL (either the default
 * pub-*.r2.dev origin or a custom domain like cdn.n2431.app).
 *
 * Env required:
 *   R2_ENDPOINT        https://<account-id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET          n2431-uploads
 *   R2_PUBLIC_URL      https://cdn.n2431.app  (no trailing slash)
 */
export class R2StorageDriver implements StorageDriver {
  readonly kind = 'r2' as const;
  readonly servesStatic = false;
  private readonly logger = new Logger(R2StorageDriver.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(opts: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
  }) {
    this.bucket = opts.bucket;
    this.publicBase = opts.publicUrl.replace(/\/$/, '');
    this.client = new S3Client({
      // R2 doesn't care which region string you send — 'auto' is the recommended
      // value in their SDK examples.
      region: 'auto',
      endpoint: opts.endpoint,
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
      // R2 requires path-style; virtual-hosted is disallowed for the default
      // account subdomain endpoint.
      forcePathStyle: true,
    });
    this.logger.log(`R2 storage → bucket=${this.bucket} public=${this.publicBase}/`);
  }

  async save(
    prefix: string,
    buffer: Buffer,
    mime: string,
    originalName?: string,
  ): Promise<StoredFile> {
    const ext = extForMime(mime, originalName);
    if (!ext) throw new Error(`UNSUPPORTED_MIME:${mime}`);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const uuid = crypto.randomUUID();
    const key = `${sanitisePrefix(prefix)}/${month}/${uuid}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
        // 1 year in the CDN; keys are UUIDs so the file at a URL never changes.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { key, url: this.publicUrl(key), size: buffer.length };
  }

  async read(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`NOT_FOUND:${key}`);
    // The SDK's Body is a stream on Node. Collect it into a buffer.
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      .catch((err) => this.logger.warn(`delete failed for ${key}: ${err.message}`));
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  extractKey(url: string): string | null {
    try {
      const u = new URL(url);
      const base = new URL(this.publicBase);
      if (u.host !== base.host) return null;
      // publicBase might carry a path (e.g. https://host/n2431). Strip it.
      const basePath = base.pathname.replace(/\/$/, '');
      let path = u.pathname;
      if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length);
      return path.replace(/^\//, '');
    } catch {
      return null;
    }
  }
}
