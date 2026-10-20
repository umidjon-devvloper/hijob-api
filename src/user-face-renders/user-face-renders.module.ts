import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { TryOnModule } from '../tryon/tryon.module';
import { UserFaceRendersService } from './user-face-renders.service';
import { UserFaceRendersController } from './user-face-renders.controller';
import { UserFaceRendersWorker } from './user-face-renders.worker';

@Module({
  imports: [PrismaModule, StorageModule, TryOnModule],
  controllers: [UserFaceRendersController],
  providers: [UserFaceRendersService, UserFaceRendersWorker],
  exports: [UserFaceRendersService],
})
export class UserFaceRendersModule {}
