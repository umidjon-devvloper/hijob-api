import { Global, Module } from '@nestjs/common';
import { EskizClient } from './eskiz.client';

@Global()
@Module({
  providers: [EskizClient],
  exports: [EskizClient],
})
export class SmsModule {}
