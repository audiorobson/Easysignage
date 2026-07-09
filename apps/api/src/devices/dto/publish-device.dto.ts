import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AssignTestContentDto } from './assign-test-content.dto';

/** Corpo igual ao de teste + rótulo opcional para o histórico de versões. */
export class PublishDeviceDto extends AssignTestContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
