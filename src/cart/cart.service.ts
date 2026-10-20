import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                titleRu: true,
                coverUrl: true,
                seller: { select: { brandName: true } },
                variants: { select: { id: true, color: true, colorHex: true, size: true, stock: true } },
              },
            },
          },
        },
      },
    });

    const itemsMapped = items.map((item) => {
      const uniqueColors = new Map<string, { color: string; colorHex: string; variantId: string }>();
      const uniqueSizes = new Map<string, { size: string; variantId: string; inStock: boolean }>();

      for (const v of item.variant.product.variants) {
        if (v.color === item.variant.color && !uniqueSizes.has(v.size)) {
          uniqueSizes.set(v.size, { size: v.size, variantId: v.id, inStock: v.stock > 0 });
        }
        if (v.size === item.variant.size && !uniqueColors.has(v.color)) {
          uniqueColors.set(v.color, { color: v.color, colorHex: v.colorHex, variantId: v.id });
        }
      }

      return {
        id: item.id,
        variantId: item.variantId,
        productId: item.variant.product.id,
        productTitle: item.variant.product.titleRu,
        productImage: item.variant.images[0] ?? item.variant.product.coverUrl,
        sellerBrand: item.variant.product.seller.brandName,
        color: item.variant.color,
        colorHex: item.variant.colorHex,
        size: item.variant.size,
        priceUsd: Number(item.variant.priceUsd ?? 0),
        quantity: item.quantity,
        availableColors: Array.from(uniqueColors.values()),
        availableSizes: Array.from(uniqueSizes.values()),
      };
    });

    return {
      items: itemsMapped,
      subtotalUsd: itemsMapped.reduce((sum, i) => sum + i.priceUsd * i.quantity, 0),
      itemCount: itemsMapped.reduce((sum, i) => sum + i.quantity, 0),
    };
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } });
    if (!variant) throw new NotFoundException('VARIANT_NOT_FOUND');

    await this.prisma.cartItem.upsert({
      where: { userId_variantId: { userId, variantId: dto.variantId } },
      create: { userId, variantId: dto.variantId, quantity: dto.quantity ?? 1 },
      update: { quantity: { increment: dto.quantity ?? 1 } },
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    if (dto.quantity <= 0) {
      await this.prisma.cartItem.deleteMany({ where: { id: itemId, userId } });
    } else {
      await this.prisma.cartItem.updateMany({
        where: { id: itemId, userId },
        data: { quantity: dto.quantity },
      });
    }
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, userId } });
    return this.getCart(userId);
  }
}
