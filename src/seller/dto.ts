import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class VariantDto {
  @IsString()
  @Length(1, 32)
  color!: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  colorHex!: string;

  @IsString()
  @Length(1, 10)
  size!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsString()
  @Length(1, 64)
  sku!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class CreateProductDto {
  @IsString()
  @Length(3, 200)
  titleRu!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  titleUz?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsIn(['scarves', 'dresses', 'bags', 'accessories'])
  categoryId!: 'scarves' | 'dresses' | 'bags' | 'accessories';

  @IsNumber()
  @Min(1)
  basePriceUsd!: number;

  @IsString()
  coverUrl!: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants!: VariantDto[];
}
