import { IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  /** Definir ou remover capa; `null` remove a imagem */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string')
  @IsUUID()
  coverAssetId?: string | null;
}
