import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GarmentCategory = 'scarves' | 'dresses' | 'bags' | 'accessories';

export interface GarmentTemplateResponse {
  version: string;
  category: GarmentCategory;
  landmarks: Record<string, unknown>;
  standard_pose: Record<string, unknown>;
  canonical_png_base64: string;
  mask_png_base64: string;
  color_palette: string[];
  warnings: string[];
}

@Injectable()
export class MlGarmentClient {
  private readonly logger = new Logger(MlGarmentClient.name);
  private readonly baseUrl: string;
  private readonly disabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('ML_GARMENT_URL') ?? 'http://localhost:5003';
    this.disabled = config.get<string>('ML_GARMENT_DISABLED') === 'true';
  }

  isEnabled(): boolean {
    return !this.disabled;
  }

  async extract(
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    category: GarmentCategory,
  ): Promise<GarmentTemplateResponse> {
    const form = new FormData();
    form.append(
      'image',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname || 'image.jpg',
    );
    form.append('category', category);

    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/garment/extract`, {
      method: 'POST',
      body: form,
    });
    const elapsed = Date.now() - started;

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`ml-garment ${res.status}: ${detail}`);
      throw new InternalServerErrorException({
        code: 'GARMENT_TEMPLATE_FAILED',
        upstream: res.status,
      });
    }

    const template = (await res.json()) as GarmentTemplateResponse;
    this.logger.log(
      `extracted ${category} template in ${elapsed}ms (palette=${template.color_palette.length}, warnings=${template.warnings.length})`,
    );
    return template;
  }
}
