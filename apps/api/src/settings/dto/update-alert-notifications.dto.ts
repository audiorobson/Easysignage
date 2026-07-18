import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAlertNotificationsDto {
  /** URL HTTPS que recebe POST com o payload do alerta (JSON). `null`/vazio desativa o webhook. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  alertWebhookUrl?: string | null;

  /** Segredo usado para assinar o corpo do webhook (HMAC-SHA256, header `X-EasySignage-Signature`). */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  alertWebhookSecret?: string | null;

  /** Lista de e-mails separados por vírgula. `null`/vazio desativa notificação por e-mail. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  alertNotifyEmails?: string | null;
}
