import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/** Criar asset: ficheiro (base64) OU referência remota (URL ou RTSP). */
export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Se definido, cria asset remoto (`url` ou `rtsp`). Ignora mime/data. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  remoteUrl?: string;

  /** Tipo de fonte remota; se omitido, infere pelo protocolo da URL. */
  @IsOptional()
  @IsIn(['url', 'rtsp'])
  kind?: 'url' | 'rtsp';

  @IsOptional()
  @IsString()
  mimeType?: string;

  /** Base64 ou data URL */
  @IsOptional()
  @IsString()
  @MinLength(1)
  dataBase64?: string;
}
