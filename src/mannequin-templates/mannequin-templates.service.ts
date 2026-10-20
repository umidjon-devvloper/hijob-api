import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export type BodyType = 'slim' | 'medium' | 'full';
export type HeightBand = 'short' | 'mid' | 'tall';

interface SizeDef {
  sizeKey: string;         // `${bodyType}-${heightBand}`
  bodyType: BodyType;
  heightBand: HeightBand;
  label: string;
  minHeightCm: number;
  maxHeightCm: number;
  sortOrder: number;
}

// 3 body types × 3 height bands = 9 mannequin templates.
// The admin generates all 9 in a single 3×3 composite image, which is
// auto-split by the Dev AI panel. Height ranges are chosen so every adult
// buyer height (150-185 cm) maps to exactly one band.
const DEFAULT_SIZES: SizeDef[] = [
  { sizeKey: 'slim-short',   bodyType: 'slim',   heightBand: 'short', label: "Ozg'in · past",    minHeightCm: 150, maxHeightCm: 160, sortOrder: 0 },
  { sizeKey: 'slim-mid',     bodyType: 'slim',   heightBand: 'mid',   label: "Ozg'in · o'rta",   minHeightCm: 161, maxHeightCm: 170, sortOrder: 1 },
  { sizeKey: 'slim-tall',    bodyType: 'slim',   heightBand: 'tall',  label: "Ozg'in · baland",  minHeightCm: 171, maxHeightCm: 185, sortOrder: 2 },
  { sizeKey: 'medium-short', bodyType: 'medium', heightBand: 'short', label: "O'rtacha · past",  minHeightCm: 150, maxHeightCm: 160, sortOrder: 3 },
  { sizeKey: 'medium-mid',   bodyType: 'medium', heightBand: 'mid',   label: "O'rtacha · o'rta", minHeightCm: 161, maxHeightCm: 170, sortOrder: 4 },
  { sizeKey: 'medium-tall',  bodyType: 'medium', heightBand: 'tall',  label: "O'rtacha · baland",minHeightCm: 171, maxHeightCm: 185, sortOrder: 5 },
  { sizeKey: 'full-short',   bodyType: 'full',   heightBand: 'short', label: "To'la · past",     minHeightCm: 150, maxHeightCm: 160, sortOrder: 6 },
  { sizeKey: 'full-mid',     bodyType: 'full',   heightBand: 'mid',   label: "To'la · o'rta",    minHeightCm: 161, maxHeightCm: 170, sortOrder: 7 },
  { sizeKey: 'full-tall',    bodyType: 'full',   heightBand: 'tall',  label: "To'la · baland",   minHeightCm: 171, maxHeightCm: 185, sortOrder: 8 },
];

function bandForHeight(cm: number): HeightBand {
  if (cm <= 160) return 'short';
  if (cm <= 170) return 'mid';
  return 'tall';
}

@Injectable()
export class MannequinTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list() {
    return this.prisma.mannequinTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  // Returns a merged view: existing DB rows + any default size the admin
  // hasn't uploaded yet (as a placeholder with imageUrl: null). Lets the
  // admin page show the full 8-slot grid even on a fresh install.
  async listWithPlaceholders() {
    const rows = await this.list();
    const byKey = new Map(rows.map((r) => [r.sizeKey, r]));
    return DEFAULT_SIZES.map((def) => {
      const existing = byKey.get(def.sizeKey);
      if (existing) return { ...existing, uploaded: true };
      return {
        id: null,
        sizeKey: def.sizeKey,
        label: def.label,
        minHeightCm: def.minHeightCm,
        maxHeightCm: def.maxHeightCm,
        imageUrl: null,
        active: false,
        sortOrder: def.sortOrder,
        uploaded: false,
      };
    });
  }

  async upload(sizeKey: string, file: Express.Multer.File) {
    const defaults = DEFAULT_SIZES.find((d) => d.sizeKey === sizeKey);
    if (!defaults) throw new NotFoundException(`unknown sizeKey ${sizeKey}`);
    const stored = await this.storage.save(
      `mannequin-templates/${sizeKey}`,
      file.buffer,
      file.mimetype || 'image/png',
      `${sizeKey}.png`,
    );
    return this.prisma.mannequinTemplate.upsert({
      where: { sizeKey },
      create: {
        sizeKey,
        label: defaults.label,
        minHeightCm: defaults.minHeightCm,
        maxHeightCm: defaults.maxHeightCm,
        imageUrl: stored.url,
        sortOrder: defaults.sortOrder,
        active: true,
      },
      update: { imageUrl: stored.url, active: true },
    });
  }

  async remove(id: string) {
    return this.prisma.mannequinTemplate.delete({ where: { id } });
  }

  // Pick the mannequin that best matches a buyer's body type + height.
  // Returns null if no templates are uploaded yet — callers then fall back
  // to the hardcoded Pexels pool so the pipeline doesn't break.
  async pickForBody(
    bodyType: BodyType | null | undefined,
    heightCm: number | null | undefined,
  ): Promise<string | null> {
    const rows = await this.prisma.mannequinTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (rows.length === 0) return null;
    const body: BodyType = bodyType ?? 'medium';
    const band: HeightBand = heightCm && heightCm > 0 ? bandForHeight(heightCm) : 'mid';
    const key = `${body}-${band}`;
    const exact = rows.find((r) => r.sizeKey === key);
    if (exact) return exact.imageUrl;
    // Same body type, nearest height band.
    const sameBody = rows.find((r) => r.sizeKey.startsWith(`${body}-`));
    if (sameBody) return sameBody.imageUrl;
    // Any medium-mid or first available.
    const fallback = rows.find((r) => r.sizeKey === 'medium-mid') ?? rows[0];
    return fallback?.imageUrl ?? null;
  }

  // Back-compat shim for callers that still pass only a height.
  async pickForHeight(heightCm: number | null | undefined): Promise<string | null> {
    return this.pickForBody('medium', heightCm);
  }

  async pickForSizeKey(sizeKey: string | null | undefined): Promise<string | null> {
    if (!sizeKey) return null;
    const row = await this.prisma.mannequinTemplate.findUnique({ where: { sizeKey } });
    return row?.active ? row.imageUrl : null;
  }
}
