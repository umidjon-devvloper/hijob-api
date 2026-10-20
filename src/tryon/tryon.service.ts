import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MlCompositorClient } from './ml-compositor.client';
import { StorageService } from '../storage/storage.service';
import { TryOnRequestDto } from './dto';

type TyingStyle = 'classical' | 'loose' | 'double';

const IMAGE_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedImage {
  bytes: Buffer;
  mimetype: string;
  expiresAt: number;
}

/** Magic-number sniff so we never lie about Content-Type when the stream
 * endpoint ships bytes back. PNG + JPEG is enough — the fallback branch of
 * createFaceSwap returns PNG mannequin bytes, every other path returns JPEG,
 * and iOS silently drops the wrong mime. */
function sniffMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  return 'image/jpeg';
}

@Injectable()
export class TryOnService {
  private readonly logger = new Logger(TryOnService.name);
  private readonly imageCache = new Map<string, CachedImage>();
  private readonly publicBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly compositor: MlCompositorClient,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {
    this.publicBase = config.get<string>('API_URL') ?? 'http://localhost:4000';
  }

  getCachedImage(sessionId: string): { bytes: Buffer; mimetype: string } | null {
    const entry = this.imageCache.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.imageCache.delete(sessionId);
      return null;
    }
    return { bytes: entry.bytes, mimetype: entry.mimetype };
  }

  /**
   * Compose a scarf onto a fresh selfie. Returns the composited JPEG as a data URL
   * plus a persisted session id so the mobile client can re-open the same look.
   */
  async createPreview(
    userId: string,
    dto: TryOnRequestDto,
    faceImage: Express.Multer.File,
  ) {
    const started = Date.now();

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: {
        product: {
          select: {
            id: true,
            categoryId: true,
            titleRu: true,
            coverUrl: true,
            attributes: true,
          },
        },
        garmentTemplate: true,
      },
    });
    if (!variant) throw new NotFoundException('VARIANT_NOT_FOUND');
    const category = variant.product.categoryId;
    if (category !== 'scarves' && category !== 'dresses') {
      throw new BadRequestException('CATEGORY_NOT_SUPPORTED_YET');
    }

    const tyingStyle: TyingStyle = dto.tyingStyle ?? 'classical';
    const spec = {
      tyingStyle,
      colorHex: variant.colorHex || '#8A8D5B',
      pattern: this.inferPattern(variant.product.attributes),
    };

    let jpeg: Buffer;
    let mode: 'scarf-template' | 'scarf-procedural' | 'dress-template' = 'scarf-procedural';
    const template = variant.garmentTemplate;

    if (category === 'dresses') {
      // Dresses only work with a real template (no procedural fallback for full-body).
      if (!template || !template.canonicalImageKey) {
        throw new BadRequestException('DRESS_TEMPLATE_MISSING');
      }
      const canonical = await this.storage.read(template.canonicalImageKey);
      jpeg = await this.compositor.composeDressWithTemplate(faceImage, spec, {
        canonical,
        mimetype: 'image/png',
        landmarks: template.landmarks as Record<string, unknown>,
      });
      mode = 'dress-template';
    } else if (template && template.canonicalImageKey) {
      try {
        const canonical = await this.storage.read(template.canonicalImageKey);
        jpeg = await this.compositor.composeScarfWithTemplate(faceImage, spec, {
          canonical,
          mimetype: 'image/png',
          landmarks: template.landmarks as Record<string, unknown>,
        });
        mode = 'scarf-template';
      } catch (err) {
        this.logger.warn(
          `template compose failed for variant ${variant.id}; falling back: ${(err as Error).message}`,
        );
        jpeg = await this.compositor.composeScarf(faceImage, spec);
      }
    } else {
      jpeg = await this.compositor.composeScarf(faceImage, spec);
    }

    const session = await this.prisma.tryOnSession.create({
      data: {
        userId,
        variantId: variant.id,
        tyingStyle,
        latencyMs: Date.now() - started,
      },
    });

    // Cache the JPEG so /tryon/preview/:sessionId/image can stream it back to the client
    // without holding a big base64 payload in the JSON response.
    this.imageCache.set(session.id, {
      bytes: jpeg,
      mimetype: sniffMime(jpeg),
      expiresAt: Date.now() + IMAGE_CACHE_TTL_MS,
    });

    const resultUrl = `${this.publicBase}/api/v1/tryon/preview/${session.id}/image`;

    // Persist URL on the session for history lookups.
    await this.prisma.tryOnSession.update({
      where: { id: session.id },
      data: { resultUrl },
    });

    this.logger.log(
      `try-on session ${session.id} composed [${mode}] in ${session.latencyMs}ms (${(jpeg.length / 1024).toFixed(1)} KB)`,
    );

    return {
      sessionId: session.id,
      resultUrl,
      cacheKey: `tryon:${session.id}`,
      latencyMs: session.latencyMs ?? 0,
      expiresAt: new Date(Date.now() + IMAGE_CACHE_TTL_MS).toISOString(),
    };
  }

  /**
   * Buyer-side try-on against a styled mannequin photo.
   *
   * The product is expected to carry ``styledImageUrl`` (the mannequin
   * pre-dressed by the seller or seeded). We fetch that image, hand it plus
   * the buyer's selfie to ml-compositor's ``/compose/faceswap`` route, and
   * cache the result the same way the TPS compose flow does.
   */
  private heightBand(cm: number | null): 'short' | 'mid' | 'tall' {
    if (!cm || cm <= 160) return 'short';
    if (cm <= 170) return 'mid';
    return 'tall';
  }

  /** Pick the body-matched (bodyType × height band) render from the latest
   * done style-job's resultVariants map. Returns null when the product has
   * no multi-variant job yet (legacy items). */
  private async pickBodyMatchedMannequin(
    productId: string,
    bodyType: 'slim' | 'medium' | 'full',
    heightCm: number | null,
  ): Promise<string | null> {
    const job = await this.prisma.productStyleJob.findFirst({
      where: { productId, status: 'done', resultVariants: { not: Prisma.JsonNull } },
      orderBy: { finishedAt: 'desc' },
      select: { resultVariants: true },
    });
    const variants = job?.resultVariants as Record<string, string> | null | undefined;
    if (!variants) return null;
    const band = this.heightBand(heightCm);
    return (
      variants[`${bodyType}-${band}`] ??
      variants[`${bodyType}-mid`] ??
      variants['medium-mid'] ??
      Object.values(variants)[0] ??
      null
    );
  }

  async createFaceSwap(
    userId: string,
    variantId: string,
    faceImage: Express.Multer.File,
    bodyType: 'slim' | 'medium' | 'full' = 'medium',
    heightCm: number | null = null,
  ) {
    const started = Date.now();

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: { id: true, titleRu: true, categoryId: true, styledImageUrl: true, coverUrl: true },
        },
      },
    });
    if (!variant) throw new NotFoundException('VARIANT_NOT_FOUND');

    // Prefer the body-matched (bodyType × height-band) variant from the
    // latest done style-job. Falls back to the product's single
    // styledImageUrl → cover, so legacy items keep working.
    const bodyMatchedUrl = await this.pickBodyMatchedMannequin(
      variant.product.id,
      bodyType,
      heightCm,
    );
    const mannequinUrl =
      bodyMatchedUrl ?? variant.product.styledImageUrl ?? variant.product.coverUrl;
    if (!mannequinUrl) throw new BadRequestException('STYLED_IMAGE_MISSING');

    // The styledImageUrl is a public URL. In local mode it points at our own
    // express.static mount, so a plain fetch works regardless of driver.
    let mannequinBytes: Buffer;
    let mannequinMime = 'image/jpeg';
    try {
      const res = await fetch(mannequinUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      mannequinMime = res.headers.get('content-type') ?? 'image/jpeg';
      mannequinBytes = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.warn(`styled image fetch failed for ${mannequinUrl}: ${(err as Error).message}`);
      throw new BadRequestException('STYLED_IMAGE_UNREACHABLE');
    }

    // Try ML face-swap. If the mannequin has no face (our new faceless
    // mannequin renders — the "oval blank where the face would be" prompt
    // tells GPT not to paint one), the ML service returns 422
    // NO_MANNEQUIN_FACE. In that case fall back to the raw mannequin
    // image: the buyer still sees themselves in context (same body +
    // same hijab render matched to their body-type×height) even if the
    // face overlay didn't paint over the plastic head.
    // Try FaceFusion first (occlusion-aware swap + GFPGAN enhancer) —
    // visibly cleaner result. Fall back to the raw InsightFace path on
    // any failure OTHER than NO_MANNEQUIN_FACE. If BOTH report no face
    // on the mannequin we return the raw render as before so the buyer
    // still sees their body-matched hijab even if the face overlay
    // couldn't paint onto a plastic head.
    let jpeg: Buffer;
    // `swapped` tells the mobile client whether the buyer's face actually
    // landed on the mannequin, or whether we're returning the raw render
    // because no face could be detected / composed. In fallback mode the
    // Primerka overlay will draw its own face-on-top preview; in swap
    // mode the server image IS the final look and no overlay is drawn.
    let swapped = false;
    const mannequinFile = {
      buffer: mannequinBytes,
      mimetype: mannequinMime,
      filename: 'mannequin.jpg',
    };
    const isNoFace = (err: unknown): boolean => {
      const s = JSON.stringify((err as { response?: unknown })?.response ?? err);
      return /NO_MANNEQUIN_FACE|FACESWAP_UNPROCESSABLE/i.test(s);
    };
    try {
      jpeg = await this.compositor.composeFacefusion(mannequinFile, faceImage);
      swapped = true;
    } catch (ffErr) {
      if (isNoFace(ffErr)) {
        this.logger.log(
          `faceswap fallback: mannequin has no detectable face, returning raw render (${mannequinUrl})`,
        );
        jpeg = mannequinBytes;
      } else {
        this.logger.warn(
          `facefusion failed, falling back to InsightFace: ${(ffErr as Error).message}`,
        );
        try {
          jpeg = await this.compositor.composeFaceSwap(mannequinFile, faceImage);
          swapped = true;
        } catch (ifErr) {
          if (isNoFace(ifErr)) {
            jpeg = mannequinBytes;
          } else {
            throw ifErr;
          }
        }
      }
    }

    const session = await this.prisma.tryOnSession.create({
      data: {
        userId,
        variantId: variant.id,
        tyingStyle: 'classical',
        latencyMs: Date.now() - started,
      },
    });

    this.imageCache.set(session.id, {
      bytes: jpeg,
      mimetype: sniffMime(jpeg),
      expiresAt: Date.now() + IMAGE_CACHE_TTL_MS,
    });

    const resultUrl = `${this.publicBase}/api/v1/tryon/preview/${session.id}/image`;
    await this.prisma.tryOnSession.update({
      where: { id: session.id },
      data: { resultUrl },
    });

    this.logger.log(
      `faceswap session ${session.id} composed in ${session.latencyMs}ms (${(jpeg.length / 1024).toFixed(1)} KB)`,
    );

    return {
      sessionId: session.id,
      resultUrl,
      swapped,
      latencyMs: session.latencyMs ?? 0,
      expiresAt: new Date(Date.now() + IMAGE_CACHE_TTL_MS).toISOString(),
    };
  }

  async history(userId: string, limit = 20) {
    const sessions = await this.prisma.tryOnSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        variant: {
          include: { product: { select: { titleRu: true, coverUrl: true } } },
        },
      },
    });
    return sessions.map((s) => ({
      sessionId: s.id,
      variantId: s.variantId,
      productTitle: s.variant.product.titleRu,
      productImage: s.variant.product.coverUrl,
      tyingStyle: s.tyingStyle,
      resultUrl: s.resultUrl,
      addedToCart: s.addedToCart,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  private inferPattern(attributes: unknown): 'solid' | 'silk' | 'chiffon' {
    if (attributes && typeof attributes === 'object') {
      const fabric = (attributes as Record<string, unknown>).fabric;
      if (fabric === 'silk' || fabric === 'chiffon') return fabric;
    }
    return 'silk';
  }
}
