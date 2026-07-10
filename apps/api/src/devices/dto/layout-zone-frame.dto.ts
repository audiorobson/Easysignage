import { Type } from 'class-transformer';
import { IsIn, IsNumber, Max, Min } from 'class-validator';

export class LayoutZoneFrameDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  w!: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  h!: number;

  @IsIn(['percent'])
  unit!: 'percent';
}
