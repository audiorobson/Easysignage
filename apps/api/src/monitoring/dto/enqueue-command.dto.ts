import { IsObject, IsString, MaxLength } from 'class-validator';

/** Canais reservados para extensão: wol, gpio, serial, http, automation, analytics, … */
export class EnqueueCommandDto {
  @IsString()
  @MaxLength(64)
  channel!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
