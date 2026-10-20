import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        product: {
          include: {
            seller: { select: { id: true, brandName: true, logoUrl: true, rating: true } },
            variants: { select: { id: true, color: true, colorHex: true, size: true, priceUsd: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      productId: r.productId,
      addedAt: r.addedAt.toISOString(),
      product: {
        id: r.product.id,
        titleRu: r.product.titleRu,
        titleUz: r.product.titleUz,
        basePriceUsd: Number(r.product.basePriceUsd),
        coverUrl: r.product.coverUrl,
        seller: r.product.seller,
        variantCount: r.product.variants.length,
      },
    }));
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('PRODUCT_NOT_FOUND');
    // upsert so a second tap is a no-op instead of a unique-constraint error.
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return { ok: true };
  }

  async remove(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { ok: true };
  }
}
