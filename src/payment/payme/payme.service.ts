import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../push/push.service';
import {
  ERR_CANNOT_CANCEL,
  ERR_INVALID_AMOUNT,
  ERR_ORDER_NOT_FOUND,
  ERR_TRANSACTION_NOT_FOUND,
  PaymeErrorBody,
  PaymeErrorCode,
  makeError,
} from './payme.errors';

/**
 * Payme merchant JSON-RPC 2.0 handler.
 *
 * We implement the four required methods:
 *   CheckPerformTransaction — is this order payable right now?
 *   CreateTransaction       — reserve funds for this order
 *   PerformTransaction      — funds captured, mark paid
 *   CancelTransaction       — refund / expire
 *
 * The Payme sandbox calls this endpoint over HTTP Basic auth. See
 * DEPLOY_PLAYBOOK.md §7 for merchant onboarding.
 */

type PaymeState = 1 | 2 | -1 | -2;
// 1 = created / pending
// 2 = performed
// -1 = cancelled before perform
// -2 = cancelled after perform (refunded)

interface PaymeAccount {
  order_id: string;
}

interface CheckPerformParams {
  amount: number;
  account: PaymeAccount;
}

interface CreateTransactionParams {
  id: string;
  time: number;
  amount: number;
  account: PaymeAccount;
}

interface CommonParams {
  id: string;
}

@Injectable()
export class PaymeService {
  private readonly logger = new Logger(PaymeService.name);
  private readonly merchantKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
  ) {
    this.merchantKey = config.get<string>('PAYME_KEY') ?? '';
  }

  /**
   * Payme sends Basic base64("Paycom:merchant_key"). Return true iff it matches
   * this merchant's key. In non-prod we allow a dev bypass so integration tests
   * work without a real key.
   */
  verifyAuth(header: string | undefined): boolean {
    if (!this.merchantKey) {
      return process.env.NODE_ENV !== 'production';
    }
    if (!header || !header.startsWith('Basic ')) return false;
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString();
      const [, key] = decoded.split(':');
      return key === this.merchantKey;
    } catch {
      return false;
    }
  }

  async checkPerformTransaction(params: CheckPerformParams): Promise<
    { allow: true } | { error: PaymeErrorBody }
  > {
    const order = await this.prisma.order.findUnique({ where: { id: params.account.order_id } });
    if (!order) return { error: ERR_ORDER_NOT_FOUND };
    // Payme sends amount in tiyin (1/100 UZS). Our DB stores USD → convert with a fixed rate.
    // For MVP we assume a plausible rate; real prod pipes the rate through env.
    const rate = Number(this.config.get('USD_UZS_RATE') ?? 12800);
    const expected = Math.round(Number(order.totalUsd) * rate * 100);
    if (params.amount !== expected) return { error: ERR_INVALID_AMOUNT };
    return { allow: true };
  }

  async createTransaction(params: CreateTransactionParams) {
    const order = await this.prisma.order.findUnique({ where: { id: params.account.order_id } });
    if (!order) return { error: ERR_ORDER_NOT_FOUND };

    // Idempotent: if a payment for this order + external id already exists, return it.
    if (order.paymentTxId === params.id) {
      return {
        result: {
          create_time: params.time,
          transaction: order.paymentTxId,
          state: order.paymentStatus === 'paid' ? (2 as PaymeState) : (1 as PaymeState),
        },
      };
    }

    // Another provider transaction is already attached — refuse.
    if (order.paymentTxId && order.paymentTxId !== params.id) {
      return {
        error: makeError(
          -31099 as PaymeErrorCode,
          'Заказ уже оплачивается',
          "Buyurtma allaqachon to'lanmoqda",
          'Order already has a transaction',
        ),
      };
    }

    const check = await this.checkPerformTransaction({
      amount: params.amount,
      account: params.account,
    });
    if ('error' in check) return { error: check.error };

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentTxId: params.id,
        paymentStatus: 'pending',
      },
    });

    return {
      result: {
        create_time: params.time,
        transaction: params.id,
        state: 1 as PaymeState,
      },
    };
  }

  async performTransaction(params: CommonParams) {
    const order = await this.prisma.order.findFirst({ where: { paymentTxId: params.id } });
    if (!order) return { error: ERR_TRANSACTION_NOT_FOUND };

    if (order.paymentStatus === 'paid') {
      // Payme retries — must be idempotent.
      return {
        result: {
          transaction: order.paymentTxId,
          perform_time: order.updatedAt.getTime(),
          state: 2 as PaymeState,
        },
      };
    }
    if (order.paymentStatus === 'refunded') {
      return { error: ERR_CANNOT_CANCEL };
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
      },
    });

    this.logger.log(`order ${updated.id} marked paid via Payme (tx=${params.id})`);

    // Fire-and-forget push. Never let a notification failure roll back the payment.
    void this.push
      .sendToUser(
        updated.userId,
        "To'lov qabul qilindi",
        `Buyurtmangiz #${updated.id.slice(0, 8)} tasdiqlandi. Tayyorlanmoqda.`,
        { orderId: updated.id, event: 'payment.paid' },
      )
      .catch((e) => this.logger.warn(`push after pay failed: ${(e as Error).message}`));

    return {
      result: {
        transaction: updated.paymentTxId,
        perform_time: updated.updatedAt.getTime(),
        state: 2 as PaymeState,
      },
    };
  }

  async cancelTransaction(params: CommonParams & { reason?: number }) {
    const order = await this.prisma.order.findFirst({ where: { paymentTxId: params.id } });
    if (!order) return { error: ERR_TRANSACTION_NOT_FOUND };

    const wasPaid = order.paymentStatus === 'paid';
    const state: PaymeState = wasPaid ? -2 : -1;

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: wasPaid ? 'refunded' : 'failed',
        orderStatus: 'cancelled',
      },
    });

    this.logger.log(
      `order ${updated.id} cancelled via Payme (tx=${params.id}, wasPaid=${wasPaid}, reason=${params.reason ?? '-'})`,
    );

    return {
      result: {
        transaction: updated.paymentTxId,
        cancel_time: updated.updatedAt.getTime(),
        state,
      },
    };
  }

  async checkTransaction(params: CommonParams) {
    const order = await this.prisma.order.findFirst({ where: { paymentTxId: params.id } });
    if (!order) return { error: ERR_TRANSACTION_NOT_FOUND };

    let state: PaymeState = 1;
    if (order.paymentStatus === 'paid') state = 2;
    else if (order.paymentStatus === 'refunded') state = -2;
    else if (order.paymentStatus === 'failed') state = -1;

    return {
      result: {
        transaction: order.paymentTxId,
        create_time: order.createdAt.getTime(),
        perform_time: state === 2 ? order.updatedAt.getTime() : 0,
        cancel_time: state < 0 ? order.updatedAt.getTime() : 0,
        state,
        reason: null,
      },
    };
  }
}
