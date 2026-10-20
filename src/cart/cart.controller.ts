import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, CurrentUserInfo } from '../auth/current-user.decorator';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: CurrentUserInfo) {
    return this.cart.getCart(user.id);
  }

  @Post()
  add(@CurrentUser() user: CurrentUserInfo, @Body() dto: AddToCartDto) {
    return this.cart.addToCart(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserInfo,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserInfo, @Param('id') id: string) {
    return this.cart.removeItem(user.id, id);
  }
}
