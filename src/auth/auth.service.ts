import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EskizClient } from '../sms/eskiz.client';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly eskiz: EskizClient,
  ) {}

  async register(dto: RegisterDto) {
    const username = dto.username.replace(/^@/, '').toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { phone: dto.phone }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.username === username ? 'USERNAME_TAKEN' : 'PHONE_TAKEN',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // MVP dev mode: skip OTP, mark phone verified immediately.
    // Role=seller also provisions an unverified Seller profile so the new
    // merchant can immediately upload products / mannequins without a
    // separate onboarding step. brandName defaults to the full name; the
    // seller can rename it later from the dashboard.
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          phone: dto.phone,
          fullName: dto.fullName,
          role: dto.role,
          language: dto.language ?? 'ru',
          passwordHash,
          phoneVerified: true,
        },
      });
      if (dto.role === 'seller') {
        await tx.seller.create({
          data: {
            userId: u.id,
            brandName: (dto.fullName || username || 'Yangi do\'kon').slice(0, 120),
            verified: false,
          },
        });
      }
      return u;
    });

    return this.issueTokens(user);
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // MVP dev mode: any code, or no OTP row at all, verifies the phone.
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new UnauthorizedException('USER_NOT_FOUND');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });

    return this.issueTokens(updated);
  }

  async login(dto: LoginDto) {
    const isPhone = dto.identifier.startsWith('+');
    const identifier = isPhone ? dto.identifier : dto.identifier.replace(/^@/, '').toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: isPhone ? { phone: identifier } : { username: identifier },
    });

    if (!user) throw new UnauthorizedException('INVALID_CREDENTIALS');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('INVALID_CREDENTIALS');

    // Admins can lock an account by setting isActive=false. We refuse login
    // here instead of letting them in and failing at the first guard.
    if (!user.isActive) throw new UnauthorizedException('ACCOUNT_SUSPENDED');

    if (!user.phoneVerified) {
      await this.sendOtp(user.phone);
      throw new UnauthorizedException('PHONE_NOT_VERIFIED');
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID');
    }

    // Rotate
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user);
  }

  private async issueTokens(user: { id: string; username: string; role: string; phone: string; fullName: string | null; language: string; createdAt: Date; onboardingFaceDone: boolean; onboardingBodyDone: boolean }) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload);

    const refreshTokenRaw = crypto.randomBytes(48).toString('base64url');
    const refreshTokenHash = this.hashToken(refreshTokenRaw);
    const refreshTtlDays = 90;

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 3600 * 1000),
      },
    });

    return {
      user: this.toPublicUser(user),
      tokens: {
        accessToken,
        refreshToken: refreshTokenRaw,
        expiresIn: 30 * 24 * 3600,
      },
    };
  }

  private async sendOtp(phone: string) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const codeHash = await bcrypt.hash(code, 10);

    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // Prod: real SMS via Eskiz. Dev: EskizClient logs to console.
    await this.eskiz.send(phone, `N24:31 kodi: ${code}. 5 daqiqa davomida amal qiladi.`);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: {
    id: string;
    username: string;
    phone: string;
    fullName: string | null;
    role: string;
    language: string;
    createdAt: Date;
    onboardingFaceDone: boolean;
    onboardingBodyDone: boolean;
  }) {
    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      language: user.language,
      createdAt: user.createdAt.toISOString(),
      onboarding: {
        faceCaptured: user.onboardingFaceDone,
        bodyProvided: user.onboardingBodyDone,
        completedAt:
          user.onboardingFaceDone && user.onboardingBodyDone
            ? user.createdAt.toISOString()
            : null,
      },
    };
  }
}
