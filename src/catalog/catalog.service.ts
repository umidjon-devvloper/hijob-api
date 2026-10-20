import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryId, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogFiltersDto } from './dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome() {
    const [stores, categories, newArrivals] = await Promise.all([
      this.prisma.seller.findMany({
        where: { verified: true },
        take: 10,
        orderBy: { rating: 'desc' },
        select: {
          id: true,
          brandName: true,
          logoUrl: true,
          description: true,
          rating: true,
          reviewsCount: true,
          verified: true,
        },
      }),
      this.prisma.category.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.product.findMany({
        where: { status: ProductStatus.published },
        orderBy: { publishedAt: 'desc' },
        take: 12,
        include: {
          variants: { take: 1 },
          seller: { select: { brandName: true, logoUrl: true, rating: true, reviewsCount: true } },
        },
      }),
    ]);

    return { stores, categories, newArrivals: newArrivals.map((p) => this.toProductDto(p)) };
  }

  async listProducts(filters: CatalogFiltersDto) {
    const pageSize = Math.min(filters.pageSize ?? 20, 50);
    const page = Math.max(filters.page ?? 1, 1);

    // Case-insensitive match against the Russian + Uzbek titles. Short
    // strings are intentionally allowed so a 2-letter query ("хи" / "ro")
    // still returns something while the user types.
    const q = filters.q?.trim();
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.published,
      ...(filters.category && { categoryId: filters.category as CategoryId }),
      ...(filters.sellerId && { sellerId: filters.sellerId }),
      ...(q && q.length >= 2 && {
        OR: [
          { titleRu: { contains: q, mode: 'insensitive' } },
          { titleUz: { contains: q, mode: 'insensitive' } },
        ],
      }),
      ...(filters.minPrice !== undefined && { basePriceUsd: { gte: filters.minPrice } }),
      ...(filters.maxPrice !== undefined && {
        basePriceUsd: {
          ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
          lte: filters.maxPrice,
        },
      }),
      // Variant-level filters — a product matches if ANY of its variants
      // match the colour/size the buyer picked. Hijabs ship as "one-size"
      // (110x110), so a size filter effectively only trims apparel + bags.
      ...((filters.size || filters.color) && {
        variants: {
          some: {
            ...(filters.size && { size: filters.size }),
            ...(filters.color && { color: filters.color }),
          },
        },
      }),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      filters.sort === 'priceLow'
        ? { basePriceUsd: 'asc' }
        : filters.sort === 'priceHigh'
          ? { basePriceUsd: 'desc' }
          : filters.sort === 'new'
            ? { publishedAt: 'desc' }
            : { popularityScore: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          variants: true,
          seller: { select: { brandName: true, logoUrl: true, rating: true, reviewsCount: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Attach each product's latest 9-variant map so the Primerka tab can
    // show buyer-size renders in the list without a per-product round-trip.
    const productIds = items.map((p) => p.id);
    const jobs = productIds.length
      ? await this.prisma.productStyleJob.findMany({
          where: {
            productId: { in: productIds },
            status: 'done',
            resultVariants: { not: Prisma.JsonNull },
          },
          orderBy: { finishedAt: 'desc' },
          select: { productId: true, resultVariants: true },
        })
      : [];
    const variantsByProduct = new Map<string, Record<string, string>>();
    for (const j of jobs) {
      if (variantsByProduct.has(j.productId)) continue;
      if (j.resultVariants && typeof j.resultVariants === 'object') {
        variantsByProduct.set(j.productId, j.resultVariants as Record<string, string>);
      }
    }

    return {
      items: items.map((p) => this.toProductDto(p, undefined, variantsByProduct.get(p.id) ?? null)),
      total,
      page,
      pageSize,
      hasNext: page * pageSize < total,
    };
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        seller: {
          select: { id: true, brandName: true, logoUrl: true, description: true, rating: true, reviewsCount: true, verified: true },
        },
      },
    });
    if (!product) throw new NotFoundException('PRODUCT_NOT_FOUND');

    // Look up the latest "done" style-job per targetSize for this product so
    // the mobile client can show a buyer the mannequin+scarf render that
    // matches their height band. Null-size (one-size items) goes under "*".
    const jobs = await this.prisma.productStyleJob.findMany({
      where: { productId: id, status: 'done', resultUrl: { not: null } },
      orderBy: { finishedAt: 'desc' },
      select: { targetSize: true, resultUrl: true, resultVariants: true },
    });
    const renderedBySize = new Map<string, string>();
    for (const j of jobs) {
      const key = (j.targetSize ?? '*').toLowerCase();
      if (!renderedBySize.has(key) && j.resultUrl) renderedBySize.set(key, j.resultUrl);
    }
    // The newest done job's 9-variant map (if any) is what the Primerka
    // picker on mobile uses to pick a body-matched render.
    const latestWithVariants = jobs.find(
      (j) => j.resultVariants && typeof j.resultVariants === 'object',
    );
    const resultVariants = (latestWithVariants?.resultVariants as Record<string, string> | null) ?? null;
    return this.toProductDto(product, renderedBySize, resultVariants);
  }

  async listStores() {
    // Show every seller for now — a `verified` filter made sense in prod
    // (admin review flow) but blocks fresh self-registered sellers from
    // seeing their own shop in the buyer catalog. The storefront UI
    // separately shows a verified badge where appropriate.
    return this.prisma.seller.findMany({
      orderBy: [{ verified: 'desc' }, { rating: 'desc' }],
      select: {
        id: true,
        brandName: true,
        logoUrl: true,
        description: true,
        rating: true,
        reviewsCount: true,
        verified: true,
      },
    });
  }

  private toProductDto = (
    p: {
      id: string;
      sellerId: string;
      categoryId: string;
      titleRu: string;
      titleUz: string | null;
      titleEn: string | null;
      basePriceUsd: Prisma.Decimal;
      coverUrl: string;
      gallery: string[];
      attributes: Prisma.JsonValue;
      createdAt: Date;
      popularityScore: number;
      variants: Array<{
        id: string;
        color: string;
        colorHex: string;
        size: string;
        priceUsd: Prisma.Decimal | null;
        stock: number;
        images: string[];
      }>;
      seller: {
        brandName: string;
        logoUrl: string | null;
        rating: Prisma.Decimal;
        reviewsCount: number;
      };
    },
    renderedBySize?: Map<string, string>,
    resultVariants?: Record<string, string> | null,
  ) => ({
    id: p.id,
    sellerId: p.sellerId,
    categoryId: p.categoryId,
    title: { ru: p.titleRu, uz: p.titleUz ?? p.titleRu, en: p.titleEn ?? p.titleRu },
    basePriceUsd: Number(p.basePriceUsd),
    coverUrl: p.coverUrl,
    gallery: p.gallery,
    attributes: p.attributes,
    createdAt: p.createdAt.toISOString(),
    popularityScore: p.popularityScore,
    // 3×3 (body-type × height) grid of rendered mannequin+scarf images.
    // Keyed like "slim-short", "medium-mid", … "full-tall". Mobile picks the
    // one matching the buyer's bodyType + height band. Null for legacy
    // products that haven't been re-rendered under the new flow.
    resultVariants: resultVariants ?? null,
    variants: p.variants.map((v) => ({
      id: v.id,
      productId: p.id,
      color: v.color,
      colorHex: v.colorHex,
      size: v.size,
      priceUsd: Number(v.priceUsd ?? p.basePriceUsd),
      stock: v.stock,
      images: v.images,
      hasTryOn: true,
      // Legacy single-render fallback (per-scarf-size), kept so older
      // clients keep working.
      renderedUrl: renderedBySize?.get((v.size ?? '').toLowerCase()) ?? null,
    })),
    seller: {
      brandName: p.seller.brandName,
      logoUrl: p.seller.logoUrl ?? '',
      rating: Number(p.seller.rating),
      reviewsCount: p.seller.reviewsCount,
    },
  });
}
