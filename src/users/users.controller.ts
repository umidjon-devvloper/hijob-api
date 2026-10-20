import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, CurrentUserInfo } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @IsOptional()
  @IsEnum(['uz', 'ru', 'en'])
  language?: 'uz' | 'ru' | 'en';
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser() user: CurrentUserInfo) {
    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      language: user.language,
      onboarding: {
        faceCaptured: user.onboardingFaceDone,
        bodyProvided: user.onboardingBodyDone,
      },
    };
  }

  // Lets the mobile Settings → Profile details screen save the user's own
  // name and language. Username and phone stay immutable because they
  // double as the login identifier and are tied to the OTP flow.
  @Patch('me')
  async updateMe(@CurrentUser() user: CurrentUserInfo, @Body() dto: UpdateMeDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.language !== undefined && { language: dto.language }),
      },
    });
    return {
      id: updated.id,
      username: updated.username,
      phone: updated.phone,
      fullName: updated.fullName,
      role: updated.role,
      language: updated.language,
      onboarding: {
        faceCaptured: updated.onboardingFaceDone,
        bodyProvided: updated.onboardingBodyDone,
      },
    };
  }
}
