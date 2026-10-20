import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, CurrentUserInfo } from '../auth/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { BodyParamsDto } from './dto';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

@ApiTags('onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('body')
  getBody(@CurrentUser() user: CurrentUserInfo) {
    return this.onboarding.getBodyParams(user.id);
  }

  @Put('body')
  saveBody(@CurrentUser() user: CurrentUserInfo, @Body() dto: BodyParamsDto) {
    return this.onboarding.saveBodyParams(user.id, dto);
  }

  @Get('face/status')
  faceStatus(@CurrentUser() user: CurrentUserInfo) {
    return this.onboarding.getFaceStatus(user.id);
  }

  @Post('face/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front', maxCount: 1 },
        { name: 'left', maxCount: 1 },
        { name: 'right', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES } },
    ),
  )
  async uploadFace(
    @CurrentUser() user: CurrentUserInfo,
    @UploadedFiles()
    files: {
      front?: Express.Multer.File[];
      left?: Express.Multer.File[];
      right?: Express.Multer.File[];
    },
  ) {
    const front = files.front?.[0];
    if (!front) throw new BadRequestException('FRONT_IMAGE_REQUIRED');

    return this.onboarding.uploadFace(user.id, {
      front,
      left: files.left?.[0],
      right: files.right?.[0],
    });
  }

  @Delete('face')
  deleteFace(@CurrentUser() user: CurrentUserInfo) {
    return this.onboarding.deleteFaceTemplate(user.id);
  }

  /**
   * One-shot: hand us a selfie, get back a URL to a transparent-background PNG
   * cropped to just the face. The Primerka tab uses it as the overlay above
   * every mannequin render so there's no boxy portrait rectangle on screen.
   */
  @Post('face/preview')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async faceOnly(
    @CurrentUser() user: CurrentUserInfo,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    if (!image) throw new BadRequestException('IMAGE_REQUIRED');
    return this.onboarding.extractFaceOnly(user.id, image);
  }

  /**
   * Zero-knowledge encrypted vault.
   *
   * The phone holds the key in iOS Keychain / Android Keystore and sends only
   * the ciphertext here; we store it opaquely under the user's prefix. The
   * backend has no way to decrypt — this exists so the user can later review
   * their selfie on-device without us ever being able to.
   */
  @Post('face/vault')
  storeFaceVault(
    @CurrentUser() user: CurrentUserInfo,
    @Body()
    body: {
      encryption: string;
      shots: Array<{
        view: 'front' | 'left' | 'right';
        payload: string;
        mac: string;
        plaintextBytes: number;
      }>;
    },
  ) {
    if (body.encryption !== 'aes-256-cbc-v1') {
      throw new BadRequestException('UNSUPPORTED_ENCRYPTION');
    }
    if (!Array.isArray(body.shots) || body.shots.length === 0) {
      throw new BadRequestException('NO_SHOTS');
    }
    return this.onboarding.storeEncryptedFaceVault(user.id, body.shots);
  }
}
