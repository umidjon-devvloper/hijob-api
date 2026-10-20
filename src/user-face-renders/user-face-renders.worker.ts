import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserFaceRendersService } from './user-face-renders.service';

/**
 * In-process worker loop that drains pending UserFaceRenderJob rows.
 *
 * Same pattern as StyleJobsWorker — a transactional claimNext means two
 * processes won't double-run one row, so you can peel this off into a
 * dedicated worker binary later without touching the queue code.
 *
 * Disabled by env `FACE_RENDER_WORKER_ENABLED=false` (default on).
 */
@Injectable()
export class UserFaceRendersWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(UserFaceRendersWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  constructor(
    private readonly jobs: UserFaceRendersService,
    private readonly config: ConfigService,
  ) {
    this.intervalMs = Number(
      this.config.get<string>('FACE_RENDER_WORKER_INTERVAL_MS') ?? 5000,
    );
    this.enabled =
      (this.config.get<string>('FACE_RENDER_WORKER_ENABLED') ?? 'true') !==
      'false';
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        'user-face-renders worker disabled (FACE_RENDER_WORKER_ENABLED=false)',
      );
      return;
    }
    this.logger.log(
      `user-face-renders worker starting (tick=${this.intervalMs}ms)`,
    );
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const claimed = await this.jobs.claimNext();
      if (!claimed) return;
      this.logger.log(
        `claimed render ${claimed.id} (user ${claimed.userId}, variant ${claimed.variantId})`,
      );
      await this.jobs.processJob(claimed.id);
    } catch (err) {
      this.logger.error(
        `user-face-renders worker tick crashed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
