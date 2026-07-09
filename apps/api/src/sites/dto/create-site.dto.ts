import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  /** Asset de imagem (tenant) usado como capa visual do espaço */
  @IsOptional()
  @IsUUID()
  coverAssetId?: string;
}
