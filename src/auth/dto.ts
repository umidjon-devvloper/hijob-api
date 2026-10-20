import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

const UZ_PHONE_REGEX = /^\+998\d{9}$/;
const USERNAME_REGEX = /^@?[a-z0-9_]{3,32}$/i;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  fullName!: string;

  @IsString()
  @Matches(USERNAME_REGEX, { message: 'Username must be 3-32 chars: a-z, 0-9, _' })
  username!: string;

  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: 'Phone must be +998XXXXXXXXX' })
  phone!: string;

  // 6 chars matches the mobile client's own validation. The old 8-char
  // minimum silently 400'd registrations that passed the client check.
  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['buyer', 'seller'])
  role!: 'buyer' | 'seller';

  @IsOptional()
  @IsEnum(['uz', 'ru', 'en'])
  language?: 'uz' | 'ru' | 'en';
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // phone or @username

  @IsString()
  @MinLength(6)
  password!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(UZ_PHONE_REGEX)
  phone!: string;

  @IsString()
  @Length(4, 6)
  code!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
