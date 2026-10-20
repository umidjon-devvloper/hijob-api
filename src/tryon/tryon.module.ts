import { Module } from '@nestjs/common';
import { TryOnController } from './tryon.controller';
import { TryOnService } from './tryon.service';
import { MlCompositorClient } from './ml-compositor.client';

@Module({
  controllers: [TryOnController],
  providers: [TryOnService, MlCompositorClient],
  exports: [MlCompositorClient],
})
export class TryOnModule {}
