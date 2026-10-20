import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, CurrentUserInfo } from '../auth/current-user.decorator';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserInfo) {
    return this.wishlist.list(user.id);
  }

  @Post(':productId')
  add(
    @CurrentUser() user: CurrentUserInfo,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.wishlist.add(user.id, productId);
  }

  @Delete(':productId')
  remove(
    @CurrentUser() user: CurrentUserInfo,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.wishlist.remove(user.id, productId);
  }
}
