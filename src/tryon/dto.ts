import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class TryOnRequestDto {
  @IsUUID()
  variantId!: string;

  @IsOptional()
  @IsIn(['classical', 'loose', 'double'])
  tyingStyle?: 'classical' | 'loose' | 'double';

  @IsOptional()
  @IsIn(['studio', 'warm', 'cool'])
  lightingPreset?: 'studio' | 'warm' | 'cool';
}
