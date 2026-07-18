import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAlertNotificationsDto } from './dto/update-alert-notifications.dto';
import { UpdateSsoConfigDto } from './dto/update-sso-config.dto';

const ALERT_NOTIFICATIONS_SELECT = {
  alertWebhookUrl: true,
  alertWebhookSecret: true,
  alertNotifyEmails: true,
} as const;

const SSO_CONFIG_SELECT = {
  ssoEnabled: true,
  ssoIssuerUrl: true,
  ssoClientId: true,
  ssoClientSecret: true,
} as const;

/** Mascara o segredo do webhook na resposta — nunca devolve o valor em claro após a gravação inicial. */
function maskSecret(secret: string | null): string | null {
  if (!secret) return null;
  return secret.length <= 4 ? '••••' : `••••${secret.slice(-4)}`;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  /** URL de callback a registar na app OIDC do provedor de identidade. */
  get ssoRedirectUri(): string {
    const apiUrl = (this.config.get<string>('API_URL') ?? 'http://localhost:3001/api/v1').replace(
      /\/$/,
      ''
    );
    return `${apiUrl}/auth/sso/callback`;
  }

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

  async getSsoConfig(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: SSO_CONFIG_SELECT,
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return this.presentSsoConfig(tenant);
  }

  async updateSsoConfig(tenantId: string, dto: UpdateSsoConfigDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: SSO_CONFIG_SELECT,
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const nextEnabled = dto.ssoEnabled ?? tenant.ssoEnabled;
    const nextIssuer =
      dto.ssoIssuerUrl !== undefined ? dto.ssoIssuerUrl?.trim() || null : tenant.ssoIssuerUrl;
    const nextClientId =
      dto.ssoClientId !== undefined ? dto.ssoClientId?.trim() || null : tenant.ssoClientId;
    const nextSecret = dto.ssoClientSecret?.trim() ? dto.ssoClientSecret.trim() : tenant.ssoClientSecret;

    if (nextEnabled && (!nextIssuer || !nextClientId || !nextSecret)) {
      throw new BadRequestException(
        'Para ativar o SSO é necessário configurar Issuer, Client ID e Client secret.'
      );
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ssoEnabled: nextEnabled,
        ssoIssuerUrl: nextIssuer,
        ssoClientId: nextClientId,
        ssoClientSecret: nextSecret,
      },
      select: SSO_CONFIG_SELECT,
    });

    return this.presentSsoConfig(updated);
  }

  private presentSsoConfig(tenant: {
    ssoEnabled: boolean;
    ssoIssuerUrl: string | null;
    ssoClientId: string | null;
    ssoClientSecret: string | null;
  }) {
    return {
      ssoEnabled: tenant.ssoEnabled,
      ssoIssuerUrl: tenant.ssoIssuerUrl,
      ssoClientId: tenant.ssoClientId,
      hasClientSecret: Boolean(tenant.ssoClientSecret),
      redirectUri: this.ssoRedirectUri,
    };
  }
}
