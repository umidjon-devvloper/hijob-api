import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { TryOnModule } from '../tryon/tryon.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MannequinTemplatesModule } from '../mannequin-templates/mannequin-templates.module';
import { UserFaceRendersModule } from '../user-face-renders/user-face-renders.module';
import { StyleJobsService } from './style-jobs.service';
import { StyleJobsController } from './style-jobs.controller';
import { StyleJobsWorker } from './style-jobs.worker';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    TryOnModule,
    NotificationsModule,
    MannequinTemplatesModule,
    UserFaceRendersModule,
  ],
  // StorageModule is already imported — nothing extra to add here; the
  // controller takes StorageService via DI from the same scope.
  controllers: [StyleJobsController],
  providers: [StyleJobsService, StyleJobsWorker],
  exports: [StyleJobsService],
})
export class StyleJobsModule {}
