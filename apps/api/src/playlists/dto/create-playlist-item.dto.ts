import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreatePlaylistItemDto {
  @IsUUID()
  assetId!: string;

  /** Duração de exibição sugerida (segundos); opcional */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  durationSec?: number;
}
