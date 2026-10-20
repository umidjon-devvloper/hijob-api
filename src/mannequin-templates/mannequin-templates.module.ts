import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { MannequinTemplatesController } from './mannequin-templates.controller';
import { MannequinTemplatesService } from './mannequin-templates.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [MannequinTemplatesController],
  providers: [MannequinTemplatesService],
  exports: [MannequinTemplatesService],
})
export class MannequinTemplatesModule {}
