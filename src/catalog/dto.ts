import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CatalogFiltersDto {
  @IsOptional()
  @IsIn(['scarves', 'dresses', 'bags', 'accessories'])
  category?: 'scarves' | 'dresses' | 'bags' | 'accessories';

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['popularity', 'priceLow', 'priceHigh', 'new'])
  sort?: 'popularity' | 'priceLow' | 'priceHigh' | 'new';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
