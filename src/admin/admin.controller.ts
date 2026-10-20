import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

/**
 * All /admin endpoints require role=admin OR role=moderator. Attach the pair
 * of guards at the controller level so the role check sees the JWT user.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  /* ─ sellers ─ */

  @Get('sellers')
  listSellers() {
    return this.admin.listSellers();
  }

  @Patch('sellers/:id/verify')
  verifySeller(@Param('id') id: string, @Body() body: { verified: boolean }) {
    return this.admin.setSellerVerified(id, Boolean(body.verified));
  }

  @Patch('sellers/:id/ban')
  banSeller(@Param('id') id: string, @Body() body: { banned: boolean }) {
    return this.admin.banSellerUser(id, Boolean(body.banned));
  }

  /* ─ products ─ */

  @Get('products')
  listProducts(@Query('status') status?: string) {
    if (status && !isProductStatus(status)) {
      throw new BadRequestException('INVALID_STATUS');
    }
    return this.admin.listProducts(status as ProductStatus | undefined);
  }

  @Patch('products/:id/status')
  setProductStatus(@Param('id') id: string, @Body() body: { status: string }) {
    if (!isProductStatus(body.status)) {
      throw new BadRequestException('INVALID_STATUS');
    }
    return this.admin.setProductStatus(id, body.status as ProductStatus);
  }

  /* ─ users ─ */

  @Get('users')
  listUsers(@Query('role') role?: string) {
    const allowed = ['buyer', 'seller', 'admin', 'moderator'];
    if (role && !allowed.includes(role)) throw new BadRequestException('INVALID_ROLE');
    return this.admin.listUsers(role as 'buyer' | 'seller' | 'admin' | 'moderator' | undefined);
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string, @Body() body: { banned: boolean }) {
    return this.admin.banUser(id, Boolean(body.banned));
  }

  /* ─ orders ─ */

  @Get('orders')
  listOrders() {
    return this.admin.listOrders();
  }
}

function isProductStatus(v: string): v is ProductStatus {
  return ['draft', 'pending', 'published', 'archived', 'rejected'].includes(v);
}
