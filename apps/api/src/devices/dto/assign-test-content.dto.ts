import { IsOptional, IsUUID } from 'class-validator';

/** Informe exatamente um dos dois: `assetId` (imagem única) ou `playlistId`. */
export class AssignTestContentDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  playlistId?: string;
}
