import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAlertNotificationsDto } from './dto/update-alert-notifications.dto';

const ALERT_NOTIFICATIONS_SELECT = {
  alertWebhookUrl: true,
  alertWebhookSecret: true,
  alertNotifyEmails: true,
} as const;

/** Mascara o segredo do webhook na resposta — nunca devolve o valor em claro após a gravação inicial. */
function maskSecret(secret: string | null): string | null {
  if (!secret) return null;
  return secret.length <= 4 ? '••••' : `••••${secret.slice(-4)}`;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlertNotifications(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: ALERT_NOTIFICATIONS_SELECT,
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return {
      alertWebhookUrl: tenant.alertWebhookUrl,
      alertWebhookSecretMasked: maskSecret(tenant.alertWebhookSecret),
      hasWebhookSecret: Boolean(tenant.alertWebhookSecret),
      alertNotifyEmails: tenant.alertNotifyEmails,
    };
  }

  async updateAlertNotifications(tenantId: string, dto: UpdateAlertNotificationsDto) {
    const data: Record<string, string | null> = {};
    if ('alertWebhookUrl' in dto) {
      data.alertWebhookUrl = dto.alertWebhookUrl?.trim() || null;
    }
    if ('alertWebhookSecret' in dto) {
      data.alertWebhookSecret = dto.alertWebhookSecret?.trim() || null;
    }
    if ('alertNotifyEmails' in dto) {
      data.alertNotifyEmails = dto.alertNotifyEmails?.trim() || null;
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: ALERT_NOTIFICATIONS_SELECT,
    });
    return {
      alertWebhookUrl: tenant.alertWebhookUrl,
      alertWebhookSecretMasked: maskSecret(tenant.alertWebhookSecret),
      hasWebhookSecret: Boolean(tenant.alertWebhookSecret),
      alertNotifyEmails: tenant.alertNotifyEmails,
    };
  }
}
