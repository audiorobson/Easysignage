import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePlaylistItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  durationSec?: number | null;
}
