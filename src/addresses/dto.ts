import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  district!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  building!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  landmark?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @IsString() @MaxLength(160) street?: string;
  @IsOptional() @IsString() @MaxLength(40) building?: string;
  @IsOptional() @IsString() @MaxLength(40) apartment?: string;
  @IsOptional() @IsString() @MaxLength(240) landmark?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
