import * as path from 'path';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);

export function extForMime(mime: string, originalName?: string): string | null {
  const m = mime.toLowerCase().split(';')[0]!.trim();
  switch (m) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/heic':
    case 'image/heif':
      return '.heic';
    default:
      if (originalName) {
        const dot = originalName.lastIndexOf('.');
        if (dot > -1) {
          const ext = originalName.slice(dot).toLowerCase();
          if (ALLOWED_EXT.has(ext)) return ext;
        }
      }
      return null;
  }
}

/** Keep the prefix segment ASCII-safe. Prevents path traversal like `../../etc`. */
export function sanitisePrefix(prefix: string): string {
  return prefix
    .split('/')
    .map((seg) => seg.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .filter(Boolean)
    .join('/');
}

/** Reject absolute paths and parent traversal for local read/delete. */
export function sanitiseKey(key: string): string | null {
  const normalised = path.posix.normalize(key);
  if (normalised.startsWith('..') || path.isAbsolute(normalised)) return null;
  return normalised;
}
