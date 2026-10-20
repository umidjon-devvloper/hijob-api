import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StyleJobsService } from './style-jobs.service';

/**
 * In-process worker loop that drains pending ProductStyleJob rows.
 *
 * Lives inside the API process so a dev machine needs no extra service. In
 * production you'd typically peel this off into its own Node worker (same
 * code, same env, just a different entrypoint) and scale it horizontally;
 * ``claimNext`` uses a transactional update, so multiple workers won't
 * double-process a row.
 *
 * Disabled by env ``STYLE_WORKER_ENABLED=false`` for tests / CI.
 */
@Injectable()
export class StyleJobsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StyleJobsWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  constructor(
    private readonly jobs: StyleJobsService,
    private readonly config: ConfigService,
  ) {
    this.intervalMs = Number(this.config.get<string>('STYLE_WORKER_INTERVAL_MS') ?? 5000);
    this.enabled = (this.config.get<string>('STYLE_WORKER_ENABLED') ?? 'true') !== 'false';
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('style job worker disabled (STYLE_WORKER_ENABLED=false)');
      return;
    }
    this.logger.log(`style job worker starting (tick=${this.intervalMs}ms)`);
    // Fire a tick straight away so a job submitted during tests runs without
    // the first interval of delay.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return; // never overlap
    this.running = true;
    try {
      const claimed = await this.jobs.claimNext();
      if (!claimed) return;
      this.logger.log(`claimed job ${claimed.id} for product ${claimed.productId}`);
      await this.jobs.processJob(claimed.id);
    } catch (err) {
      this.logger.error(`worker tick crashed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
