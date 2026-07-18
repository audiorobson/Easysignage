import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_SENDER, type EmailSender } from './email-sender';

export type AlertNotificationStatus = 'open' | 'resolved';

export interface AlertNotificationPayload {
  tenantId: string;
  deviceId: string;
  alertId: string;
  alertType: string;
  severity: string;
  status: AlertNotificationStatus;
  title: string;
  message: string | null;
  occurredAt: string;
}

const WEBHOOK_TIMEOUT_MS = 5_000;

/** Extrai e normaliza uma lista de e-mails separados por vírgula (config de tenant). */
export function parseEmailList(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Assinatura HMAC-SHA256 do corpo do webhook — permite ao destinatário validar a origem. */
export function signWebhookBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function buildEmailSubject(payload: AlertNotificationPayload): string {
  return payload.status === 'open'
    ? `[EasySignage] Alerta: ${payload.title}`
    : `[EasySignage] Resolvido: ${payload.title}`;
}

export function buildEmailBody(tenantName: string, payload: AlertNotificationPayload): string {
  const lines = [
    `Tenant: ${tenantName}`,
    `Estado: ${payload.status === 'open' ? 'ABERTO' : 'RESOLVIDO'}`,
    `Severidade: ${payload.severity}`,
    `Título: ${payload.title}`,
    payload.message ? `Mensagem: ${payload.message}` : null,
    `Tipo: ${payload.alertType}`,
    `Ocorrido em: ${payload.occurredAt}`,
  ].filter((l): l is string => l != null);
  return lines.join('\n');
}

/**
 * Dispara notificações de alerta (webhook + e-mail) configuradas por tenant
 * (PR 5.18). Best-effort: nunca lança — falhas de rede/config são apenas
 * registadas em log, para não bloquear o motor de avaliação de alertas
 * (`AlertsService`).
 */
@Injectable()
export class AlertNotificationsService {
  private readonly logger = new Logger(AlertNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender
  ) {}

  async notify(payload: AlertNotificationPayload): Promise<void> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: {
          name: true,
          alertWebhookUrl: true,
          alertWebhookSecret: true,
          alertNotifyEmails: true,
        },
      });
      if (!tenant) return;

      await Promise.all([
        this.dispatchWebhook(tenant.alertWebhookUrl, tenant.alertWebhookSecret, payload),
        this.dispatchEmail(tenant.alertNotifyEmails, tenant.name, payload),
      ]);
    } catch (err) {
      this.logger.warn(
        `Falha inesperada ao notificar alerta ${payload.alertId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async dispatchWebhook(
    url: string | null,
    secret: string | null,
    payload: AlertNotificationPayload
  ): Promise<void> {
    const target = url?.trim();
    if (!target) return;
    try {
      const body = JSON.stringify({ event: `alert.${payload.status}`, data: payload });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret?.trim()) {
        headers['X-EasySignage-Signature'] = signWebhookBody(secret.trim(), body);
      }
      const res = await fetch(target, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Webhook de alerta respondeu ${res.status} (${target})`);
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao enviar webhook de alerta para ${target}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async dispatchEmail(
    emailsCsv: string | null,
    tenantName: string,
    payload: AlertNotificationPayload
  ): Promise<void> {
    const to = parseEmailList(emailsCsv);
    if (to.length === 0) return;
    try {
      await this.emailSender.send({
        to,
        subject: buildEmailSubject(payload),
        text: buildEmailBody(tenantName, payload),
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao enviar e-mail de alerta: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
