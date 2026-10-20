import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, CurrentUserInfo } from '../auth/current-user.decorator';
import { SellerService } from './seller.service';
import { CreateProductDto } from './dto';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 8;

@ApiTags('seller')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller', 'admin')
@Controller('seller')
export class SellerController {
  constructor(private readonly seller: SellerService) {}

  @Get('products')
  list(@CurrentUser() user: CurrentUserInfo) {
    return this.seller.listProducts(user.id);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: CurrentUserInfo) {
    return this.seller.getAnalytics(user.id);
  }

  // Compact stats shape consumed by the mobile seller dashboard. Different
  // from /analytics so the mobile card row stays stable even if analytics
  // grows new fields.
  @Get('stats')
  stats(@CurrentUser() user: CurrentUserInfo) {
    return this.seller.getStats(user.id);
  }

  @Get('orders')
  orders(@CurrentUser() user: CurrentUserInfo) {
    return this.seller.listOrders(user.id);
  }

  @Post('products')
  create(@CurrentUser() user: CurrentUserInfo, @Body() dto: CreateProductDto) {
    return this.seller.createProduct(user.id, dto);
  }

  @Post('products/:id/submit')
  submit(
    @CurrentUser() user: CurrentUserInfo,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.seller.submit(user.id, id);
  }

  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  upload(
    @CurrentUser() user: CurrentUserInfo,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('NO_FILES');
    return this.seller.uploadImages(user.id, files);
  }
}
