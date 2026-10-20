import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, CurrentUserInfo } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  checkout(@CurrentUser() user: CurrentUserInfo, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserInfo) {
    return this.orders.listOrders(user.id);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: CurrentUserInfo,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.orders.getOrder(user.id, id);
  }
}
