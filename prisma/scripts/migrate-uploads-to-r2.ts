/**
 * One-shot migration: copy every file under services/api/uploads/ to Cloudflare
 * R2, then rewrite matching URLs in the DB to point at the R2 public host.
 *
 * Idempotent — files that already exist under the same key in R2 are skipped,
 * and DB rows whose URL already points at R2 are left alone.
 *
 * Usage (after populating .env with R2_* creds):
 *   pnpm -F @n2431/api exec tsx prisma/scripts/migrate-uploads-to-r2.ts
 *
 * Dry run (log what would move, touch nothing):
 *   MIGRATE_DRY_RUN=1 pnpm -F @n2431/api exec tsx prisma/scripts/migrate-uploads-to-r2.ts
 */
import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as mime from 'mime-types';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.env.MIGRATE_DRY_RUN === '1';

const REQUIRED = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`✗ missing env: ${k}`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});
const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_BASE = process.env.R2_PUBLIC_URL!.replace(/\/$/, '');
const UPLOADS_ROOT = path.resolve(process.env.STORAGE_ROOT ?? path.join(process.cwd(), 'uploads'));
const OLD_URL_PREFIX = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/uploads/';

const prisma = new PrismaClient();

interface Stats {
  files: number;
  uploaded: number;
  skipped: number;
  dbRowsPatched: number;
}
const stats: Stats = { files: 0, uploaded: 0, skipped: 0, dbRowsPatched: 0 };

async function existsInR2(key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false;
    throw e;
  }
}

async function uploadFile(fullPath: string, key: string) {
  stats.files += 1;
  if (await existsInR2(key)) {
    stats.skipped += 1;
    return;
  }
  const buf = await fs.readFile(fullPath);
  const contentType = mime.lookup(fullPath) || 'application/octet-stream';
  if (DRY_RUN) {
    console.log(`  · would upload ${key} (${buf.length} bytes, ${contentType})`);
  } else {
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    console.log(`  ↑ ${key}`);
  }
  stats.uploaded += 1;
}

async function walk(dir: string, base: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, base);
    } else if (e.isFile()) {
      // key is the POSIX-style path relative to uploads/ root
      const key = path.relative(base, full).split(path.sep).join('/');
      await uploadFile(full, key);
    }
  }
}

/**
 * Every table+column that could hold an uploaded URL. Add new pairs here when
 * a schema starts storing image URLs.
 */
const REWRITE_TARGETS: Array<{ table: string; column: string }> = [
  { table: 'products', column: 'coverUrl' },
  { table: 'product_variants', column: 'images' }, // JSONB array of strings
  { table: 'garment_templates', column: 'canonicalImageUrl' },
  { table: 'garment_templates', column: 'maskUrl' },
  { table: 'face_templates', column: 'photoUrl' },
  { table: 'sellers', column: 'logoUrl' },
];

async function rewriteDbUrls() {
  const rowChanges: Array<{ table: string; count: number }> = [];

  for (const { table, column } of REWRITE_TARGETS) {
    // Try text column first, fall back to jsonb (variants.images is jsonb).
    const asText = await prisma
      .$executeRawUnsafe(
        DRY_RUN
          ? `SELECT count(*)::int as c FROM ${table} WHERE ${column}::text LIKE $1`
          : `UPDATE ${table} SET ${column} = replace(${column}::text, $1, $2)::${column === 'images' ? 'jsonb' : 'text'} WHERE ${column}::text LIKE $3`,
        DRY_RUN ? `%${OLD_URL_PREFIX}%` : OLD_URL_PREFIX,
        DRY_RUN ? undefined : `${PUBLIC_BASE}/`,
        DRY_RUN ? undefined : `%${OLD_URL_PREFIX}%`,
      )
      .catch((err: Error) => {
        console.warn(`  ! skipped ${table}.${column}: ${err.message}`);
        return 0;
      });

    if (typeof asText === 'number' && asText > 0) {
      rowChanges.push({ table: `${table}.${column}`, count: asText });
      stats.dbRowsPatched += asText;
    }
  }

  for (const r of rowChanges) {
    console.log(`  ✎ ${r.table}: ${r.count} row(s)`);
  }
}

async function main() {
  console.log('N24:31 · Local uploads → Cloudflare R2');
  console.log(`  from   : ${UPLOADS_ROOT}`);
  console.log(`  bucket : ${BUCKET}`);
  console.log(`  public : ${PUBLIC_BASE}`);
  console.log(`  mode   : ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  console.log('1. Uploading files…');
  await walk(UPLOADS_ROOT, UPLOADS_ROOT);

  console.log('\n2. Rewriting DB URLs…');
  await rewriteDbUrls();

  console.log(`\n✔ done — files scanned ${stats.files}, uploaded ${stats.uploaded}, skipped ${stats.skipped}, db rows ${stats.dbRowsPatched}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
