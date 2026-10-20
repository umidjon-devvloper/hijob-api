import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Eskiz.uz SMS gateway client.
 *
 * Docs: https://documenter.getpostman.com/view/663428/eskiz
 *
 * The token they hand out lives ~30 days. We refresh it lazily when a send
 * comes back 401 so we never block a hot request on the auth flow.
 *
 * Dev fallback: if credentials are missing OR NODE_ENV != production we log
 * the message and return true. This keeps registration testable locally
 * without burning real SMS credits.
 */
@Injectable()
export class EskizClient {
  private readonly logger = new Logger(EskizClient.name);
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private readonly from: string;
  private token: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('ESKIZ_BASE_URL') ?? 'https://notify.eskiz.uz/api';
    this.email = config.get<string>('ESKIZ_EMAIL') ?? '';
    this.password = config.get<string>('ESKIZ_PASSWORD') ?? '';
    this.from = config.get<string>('ESKIZ_FROM') ?? '4546';
  }

  isConfigured(): boolean {
    return !!this.email && !!this.password;
  }

  async send(phone: string, message: string): Promise<boolean> {
    const isProd = process.env.NODE_ENV === 'production';

    if (!this.isConfigured() || !isProd) {
      // Dev/staging: log and pretend it worked.
      this.logger.log(`[dev SMS → ${phone}] ${message}`);
      return true;
    }

    return this._send(phone, message);
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    if (!res.ok) {
      throw new Error(`Eskiz login failed: ${res.status}`);
    }
    const body = (await res.json()) as { data?: { token: string } };
    if (!body.data?.token) throw new Error('Eskiz login missing token');
    this.token = body.data.token;
    return this.token;
  }

  private async _send(phone: string, message: string, retry = false): Promise<boolean> {
    const token = await this.ensureToken();
    const form = new URLSearchParams({
      mobile_phone: phone.replace(/^\+/, ''),
      message,
      from: this.from,
    });

    const res = await fetch(`${this.baseUrl}/message/sms/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (res.status === 401 && !retry) {
      this.token = null;
      return this._send(phone, message, true);
    }

    if (!res.ok) {
      this.logger.error(`Eskiz send failed for ${phone}: ${res.status}`);
      return false;
    }
    return true;
  }
}
