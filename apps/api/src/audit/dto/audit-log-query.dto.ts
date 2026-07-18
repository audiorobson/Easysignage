import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  actorEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @IsOptional()
  @IsIn(AUDITED_METHODS)
  method?: (typeof AUDITED_METHODS)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
