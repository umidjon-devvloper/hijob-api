import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckoutItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @IsIn(['delivery', 'pickup', 'proba'])
  deliveryType!: 'delivery' | 'pickup' | 'proba';

  @IsOptional()
  @IsIn(['today', 'tomorrow', 'scheduled'])
  deliverySpeed?: 'today' | 'tomorrow' | 'scheduled';

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsUUID()
  addressId!: string;

  @IsIn(['click', 'payme', 'visa', 'mastercard', 'humo', 'uzcard'])
  paymentMethod!: 'click' | 'payme' | 'visa' | 'mastercard' | 'humo' | 'uzcard';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
