import { Injectable } from '@nestjs/common';
import { Prisma, NotificationKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      data: n.data,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: res.count };
  }

  // Internal publisher: domain services (orders, style jobs) call this to
  // drop a notification row. Push delivery stays in PushService; this is
  // the in-app inbox the bell icon renders.
  async create(input: {
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    data?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        data: input.data,
      },
    });
  }
}
