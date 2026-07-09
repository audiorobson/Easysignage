import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePlaylistDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** ex.: draft | published (string livre no MVP) */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
