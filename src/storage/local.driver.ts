import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageDriver, StoredFile } from './storage.types';
import { extForMime, sanitisePrefix, sanitiseKey } from './helpers';

/**
 * Local-filesystem driver — files land under {root}/{prefix}/{yyyy-mm}/{uuid}.{ext}
 * and are served by express.static under /uploads/. Used for dev by default.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly kind = 'local' as const;
  readonly servesStatic = true;
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly root: string;
  private readonly publicBase: string;

  constructor(opts: { root?: string; publicBaseUrl?: string }) {
    this.root = path.resolve(opts.root ?? path.join(process.cwd(), 'uploads'));
    this.publicBase = (opts.publicBaseUrl ?? 'http://localhost:4000').replace(/\/$/, '');
    this.logger.log(`local storage → ${this.root} (public: ${this.publicBase}/uploads/)`);
  }

  getRoot(): string {
    return this.root;
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
    const key = path.posix.join(sanitisePrefix(prefix), month, `${uuid}${ext}`);
    const fullPath = path.join(this.root, key);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return { key, url: this.publicUrl(key), size: buffer.length };
  }

  async read(key: string): Promise<Buffer> {
    const safe = sanitiseKey(key);
    if (!safe) throw new Error(`INVALID_KEY:${key}`);
    return fs.readFile(path.join(this.root, safe));
  }

  async delete(key: string): Promise<void> {
    const safe = sanitiseKey(key);
    if (!safe) return;
    await fs.unlink(path.join(this.root, safe)).catch((err) => {
      if (err.code !== 'ENOENT') this.logger.warn(`delete failed for ${key}: ${err.message}`);
    });
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/uploads/${key}`;
  }

  extractKey(url: string): string | null {
    try {
      const u = new URL(url, this.publicBase);
      const marker = '/uploads/';
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      return u.pathname.slice(idx + marker.length);
    } catch {
      return null;
    }
  }
}
