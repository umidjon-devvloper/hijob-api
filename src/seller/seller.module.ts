import { Module } from '@nestjs/common';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';
import { MlGarmentClient } from './ml-garment.client';

@Module({
  controllers: [SellerController],
  providers: [SellerService, MlGarmentClient],
})
export class SellerModule {}
