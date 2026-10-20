import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver, StoredFile } from './storage.types';
import { LocalStorageDriver } from './local.driver';
import { R2StorageDriver } from './r2.driver';

/**
 * Storage facade. Picks a driver at bootstrap based on env:
 *
 *   STORAGE_DRIVER=r2      → Cloudflare R2 (needs R2_* env)
 *   STORAGE_DRIVER=local   → local filesystem (default)
 *
 * Callers only see save/read/delete/extractKey — driver-agnostic.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;

  constructor(config: ConfigService) {
    const kind = (config.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase();

    if (kind === 'r2') {
      const endpoint = config.get<string>('R2_ENDPOINT');
      const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
      const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
      const bucket = config.get<string>('R2_BUCKET');
      const publicUrl = config.get<string>('R2_PUBLIC_URL');
      const missing = [
        !endpoint && 'R2_ENDPOINT',
        !accessKeyId && 'R2_ACCESS_KEY_ID',
        !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
        !bucket && 'R2_BUCKET',
        !publicUrl && 'R2_PUBLIC_URL',
      ].filter(Boolean);
      if (missing.length) {
        throw new Error(
          `STORAGE_DRIVER=r2 but missing env: ${missing.join(', ')}. See .env.example.`,
        );
      }
      this.driver = new R2StorageDriver({
        endpoint: endpoint!,
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
        bucket: bucket!,
        publicUrl: publicUrl!,
      });
    } else {
      this.driver = new LocalStorageDriver({
        root: config.get<string>('STORAGE_ROOT'),
        publicBaseUrl: config.get<string>('API_URL'),
      });
    }
    this.logger.log(`storage driver = ${this.driver.kind}`);
  }

  get kind(): 'local' | 'r2' {
    return this.driver.kind;
  }

  get servesStatic(): boolean {
    return this.driver.servesStatic;
  }

  /** Local FS root — only meaningful in local mode; returns '' otherwise. */
  getRoot(): string {
    return this.driver.getRoot?.() ?? '';
  }

  save(
    prefix: string,
    buffer: Buffer,
    mime: string,
    originalName?: string,
  ): Promise<StoredFile> {
    return this.driver.save(prefix, buffer, mime, originalName);
  }

  read(key: string): Promise<Buffer> {
    return this.driver.read(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  publicUrl(key: string): string {
    return this.driver.publicUrl(key);
  }

  extractKey(url: string): string | null {
    return this.driver.extractKey(url);
  }
}
