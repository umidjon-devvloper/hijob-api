import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BodyParamsDto } from './dto';
import { ClothingSize, FaceTemplateStatus } from '@prisma/client';
import { MlFaceClient } from './ml-face.client';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlFace: MlFaceClient,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Return just the face as a transparent-background PNG. Used by the Primerka
   * tab to drop the buyer's face onto a mannequin without pulling in hair or
   * background. Also stores the PNG under the user's prefix so the mobile
   * client can keep showing it after the request completes.
   */
  async extractFaceOnly(userId: string, front: Express.Multer.File) {
    const png = await this.mlFace.faceOnlyPng(front);
    const saved = await this.storage.save(
      `face/overlay/${userId}`,
      png,
      'image/png',
      'face-overlay.png',
    );
    return { url: saved.url, bytes: png.length };
  }

  async uploadFace(
    userId: string,
    files: {
      front: Express.Multer.File;
      left?: Express.Multer.File;
      right?: Express.Multer.File;
    },
  ) {
    const template = await this.mlFace.extractTemplate(files);

    const ttlDays = Number(this.config.get<string>('FACE_TEMPLATE_TTL_DAYS') ?? 30);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600 * 1000);

    await this.prisma.$transaction([
      this.prisma.faceTemplate.upsert({
        where: { userId },
        create: {
          userId,
          version: template.version,
          status: FaceTemplateStatus.ready,
          landmarks: template.views as unknown as object,
          skinTone: template.skin_tone as unknown as object,
          proportions: template.proportions as unknown as object,
          expiresAt,
        },
        update: {
          version: template.version,
          status: FaceTemplateStatus.ready,
          landmarks: template.views as unknown as object,
          skinTone: template.skin_tone as unknown as object,
          proportions: template.proportions as unknown as object,
          lastUsedAt: new Date(),
          expiresAt,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { onboardingFaceDone: true },
      }),
    ]);

    return {
      status: 'ready' as const,
      warnings: template.warnings,
      views: template.views.map((v) => ({
        view: v.view,
        detected: v.detected,
        landmarks: v.landmarks_2d.length,
      })),
    };
  }

  async saveBodyParams(userId: string, dto: BodyParamsDto) {
    // Mobile onboarding currently sends height/weight/bodyType; age and the
    // explicit size enum are optional, so derive sensible defaults here.
    const bodyTypeToSize: Record<'slim' | 'medium' | 'full', ClothingSize> = {
      slim: 'S' as ClothingSize,
      medium: 'M' as ClothingSize,
      full: 'L' as ClothingSize,
    };
    const size: ClothingSize =
      (dto.preferredSize as ClothingSize | undefined) ??
      (dto.bodyType ? bodyTypeToSize[dto.bodyType] : ('M' as ClothingSize));
    const age = dto.age ?? 25;

    await this.prisma.$transaction([
      this.prisma.bodyParams.upsert({
        where: { userId },
        create: {
          userId,
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          age,
          preferredSize: size,
        },
        update: {
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          age,
          preferredSize: size,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { onboardingBodyDone: true },
      }),
    ]);

    return { ok: true };
  }

  async getBodyParams(userId: string) {
    const params = await this.prisma.bodyParams.findUnique({ where: { userId } });
    if (!params) throw new NotFoundException('BODY_PARAMS_NOT_SET');
    return params;
  }

  async getFaceStatus(userId: string) {
    const template = await this.prisma.faceTemplate.findUnique({
      where: { userId },
      select: { status: true, createdAt: true, expiresAt: true },
    });

    if (!template) return { status: 'none' as const };

    return {
      status: template.status,
      createdAt: template.createdAt.toISOString(),
      expiresAt: template.expiresAt.toISOString(),
    };
  }

  async deleteFaceTemplate(userId: string) {
    await this.prisma.faceTemplate.deleteMany({ where: { userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingFaceDone: false },
    });
    return { ok: true };
  }

  /**
   * Zero-knowledge vault for client-encrypted selfies. We never see the key,
   * so we treat every blob as an opaque byte stream and persist it under a
   * per-user prefix. The FaceTemplate row keeps the prefix so a future
   * "review my photos" screen can list them.
   */
  async storeEncryptedFaceVault(
    userId: string,
    shots: Array<{
      view: 'front' | 'left' | 'right';
      payload: string;
      mac: string;
      plaintextBytes: number;
    }>,
  ) {
    const prefix = `face/vault/${userId}`;
    const stored: Array<{ view: string; key: string; url: string }> = [];
    for (const shot of shots) {
      // payload is base64 of (iv ∥ ciphertext). Decode once, store opaque.
      const buf = Buffer.from(shot.payload, 'base64');
      const sidecar = Buffer.from(
        JSON.stringify({
          view: shot.view,
          mac: shot.mac,
          plaintextBytes: shot.plaintextBytes,
          encryption: 'aes-256-cbc-v1',
          storedAt: new Date().toISOString(),
        }),
      );
      // We prefix the sidecar JSON length as 4 bytes big-endian, then the
      // sidecar, then the ciphertext. That way one GET returns everything
      // the client needs to decrypt and verify.
      const len = Buffer.alloc(4);
      len.writeUInt32BE(sidecar.length, 0);
      const bundled = Buffer.concat([len, sidecar, buf]);

      const result = await this.storage.save(
        `${prefix}/${shot.view}`,
        bundled,
        'application/octet-stream',
        `${shot.view}.bin`,
      );
      stored.push({ view: shot.view, key: result.key, url: result.url });
    }

    await this.prisma.faceTemplate.update({
      where: { userId },
      data: { s3EncryptedPhotosPrefix: prefix },
    }).catch((err) => {
      // Vault upload can arrive before the face template exists (race with
      // the plaintext pipeline). Log and keep the files; next upload or
      // reconciliation job will link them.
      this.logger.warn(`vault stored but no template yet for ${userId}: ${err.message}`);
    });

    return { stored: stored.length, prefix, files: stored };
  }
}
