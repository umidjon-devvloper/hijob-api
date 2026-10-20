import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Other modules (orders, style-jobs) create notifications through this
  // service rather than touching the Prisma table directly.
  exports: [NotificationsService],
})
export class NotificationsModule {}
