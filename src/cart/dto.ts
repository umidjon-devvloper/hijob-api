import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AddToCartDto {
  @IsUUID()
  variantId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  quantity?: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(0)
  @Max(50)
  quantity!: number;
}
