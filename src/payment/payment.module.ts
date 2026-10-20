import { Module } from '@nestjs/common';
import { PaymeController } from './payme/payme.controller';
import { PaymeService } from './payme/payme.service';

@Module({
  controllers: [PaymeController],
  providers: [PaymeService],
  exports: [PaymeService],
})
export class PaymentModule {}
