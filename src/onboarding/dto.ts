import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class BodyParamsDto {
  @IsInt()
  @Min(120)
  @Max(220)
  heightCm!: number;

  @IsInt()
  @Min(30)
  @Max(200)
  weightKg!: number;

  // Age and preferredSize are optional on the mobile onboarding — the current
  // UI only collects height/weight/bodyType and derives size from bodyType.
  // When the age/size fields are missing we fall back to sensible defaults in
  // the service so the user can finish onboarding without re-releasing the app.
  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsEnum(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
  preferredSize?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

  // The mobile picks slim/medium/full. We accept it, map it to the Prisma
  // ClothingSize when preferredSize is missing, and store the raw choice in
  // bodyParams.bodyType (future-proof for a server-side size recommender).
  @IsOptional()
  @IsEnum(['slim', 'medium', 'full'])
  bodyType?: 'slim' | 'medium' | 'full';
}
