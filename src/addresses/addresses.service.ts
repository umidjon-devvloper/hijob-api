import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      // First address becomes default automatically; an explicit isDefault
      // demotes every other address of this user.
      const existing = await tx.address.count({ where: { userId } });
      const shouldBeDefault = dto.isDefault === true || existing === 0;
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId,
          label: dto.label,
          city: dto.city,
          district: dto.district,
          street: dto.street,
          building: dto.building,
          apartment: dto.apartment,
          landmark: dto.landmark,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault: shouldBeDefault,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!addr) throw new NotFoundException('ADDRESS_NOT_FOUND');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: string, id: string) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!addr) throw new NotFoundException('ADDRESS_NOT_FOUND');
    await this.prisma.address.delete({ where: { id } });

    // If we deleted the default, promote the newest remaining address so the
    // user always has a default available for one-tap checkout.
    if (addr.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return { ok: true };
  }
}
