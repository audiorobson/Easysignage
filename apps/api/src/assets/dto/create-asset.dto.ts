import { IsOptional, IsString, MinLength } from 'class-validator';

/** Criar asset: ficheiro (base64) OU referência URL (sem ficheiro local). */
export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Se definido, cria asset `kind=url` (HTTPS). Ignora mime/data. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  remoteUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  /** Base64 ou data URL */
  @IsOptional()
  @IsString()
  @MinLength(1)
  dataBase64?: string;
}
