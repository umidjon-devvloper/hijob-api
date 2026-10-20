import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MannequinTemplatesService } from './mannequin-templates.service';

@ApiTags('mannequin-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
@Controller('admin/mannequin-templates')
export class MannequinTemplatesController {
  constructor(private readonly templates: MannequinTemplatesService) {}

  @Get()
  list() {
    return this.templates.listWithPlaceholders();
  }

  @Post(':sizeKey/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 16 * 1024 * 1024 } }))
  upload(@Param('sizeKey') sizeKey: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    return this.templates.upload(sizeKey, file);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.templates.remove(id);
  }
}
