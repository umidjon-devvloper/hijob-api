import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Expo Push Notifications.
 *
 * We don't need any credentials for Expo's own push service — as long as the
 * mobile app is signed with an Expo project the token starts with
 * "ExponentPushToken[...]" and we can POST straight to
 * https://exp.host/--/api/v2/push/send.
 *
 * The service is fire-and-forget: bad tokens get pruned lazily when Expo
 * responds with DeviceNotRegistered.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, token: string, platform: string) {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform: platform.slice(0, 16),
      },
      update: {
        userId,
        lastUsedAt: new Date(),
        platform: platform.slice(0, 16),
      },
    });
    return { ok: true };
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return { sent: 0 };

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      sound: 'default',
      data: data ?? {},
    }));

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const result = (await res.json()) as { data?: Array<{ status: string; details?: any }> };

      // Prune tokens Expo said are dead.
      if (Array.isArray(result.data)) {
        const dead: string[] = [];
        result.data.forEach((r, i) => {
          if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') {
            dead.push(tokens[i]!.token);
          }
        });
        if (dead.length) {
          await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
        }
      }
      this.logger.log(`push sent to user ${userId}: ${tokens.length} device(s)`);
      return { sent: tokens.length };
    } catch (err) {
      this.logger.error(`push failed for ${userId}: ${(err as Error).message}`);
      return { sent: 0 };
    }
  }
}
