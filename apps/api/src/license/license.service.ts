import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hostname } from 'node:os';
import {
  DEFAULT_PRODUCTION_PUBLIC_KEY_FILE,
  DEV_LICENSE_PUBLIC_KEY_PEM,
  deriveHardwareId,
  isValidHardwareId,
  normalizeHardwareId,
  tierFeatures,
  tierHasFeature,
  tierLabelPt,
  tierMaxPlayers,
  verifyLicense,
  type LicenseFeature,
  type LicenseStatus,
  type LicenseTier,
} from '@easysignage/license-core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private cachedStatus: LicenseStatus | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshFromEnvironment();
  }

  private readText(path: string | undefined): string | null {
    if (!path?.trim()) return null;
    try {
      if (!existsSync(path)) return null;
      const text = readFileSync(path, 'utf8').trim();
      return text || null;
    } catch {
      return null;
    }
  }

  resolveHardwareId(): string {
    const fromEnv = this.config.get<string>('EASYSIGNAGE_HARDWARE_ID')?.trim();
    if (fromEnv && isValidHardwareId(fromEnv)) {
      return normalizeHardwareId(fromEnv);
    }

    const filePath =
      this.config.get<string>('EASYSIGNAGE_HARDWARE_ID_FILE') ??
      '/config/hardware.id';
    const fromFile = this.readText(filePath);
    if (fromFile && isValidHardwareId(fromFile)) {
      return normalizeHardwareId(fromFile);
    }

    const devId = deriveHardwareId([
      hostname(),
      process.platform,
      'easysignage-dev-fallback',
    ]);
    this.logger.warn(
      `Hardware ID não encontrado (${filePath}); a usar ID derivado do host para desenvolvimento: ${devId}`
    );
    return devId;
  }

  resolvePublicKeyPem(): string {
    const inline = this.config.get<string>('LICENSE_PUBLIC_KEY')?.trim();
    if (inline?.includes('BEGIN PUBLIC KEY')) {
      return inline;
    }
    const filePath =
      this.config.get<string>('LICENSE_PUBLIC_KEY_FILE') ??
      (process.env.NODE_ENV === 'production'
        ? DEFAULT_PRODUCTION_PUBLIC_KEY_FILE
        : undefined);
    const fromFile = this.readText(filePath);
    if (fromFile?.includes('BEGIN PUBLIC KEY')) {
      return fromFile;
    }

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      this.logger.error(
        'Produção sem LICENSE_PUBLIC_KEY ou license-public.pem — licenças comerciais não serão validadas correctamente'
      );
    } else {
      this.logger.warn(
        'A usar chave pública de desenvolvimento (apenas para dev local)'
      );
    }
    return DEV_LICENSE_PUBLIC_KEY_PEM;
  }

  async getCurrentTier(): Promise<LicenseTier> {
    const status = await this.getStatus();
    return status.tier;
  }

  async assertFeature(feature: LicenseFeature): Promise<void> {
    const tier = await this.getCurrentTier();
    if (!tierHasFeature(tier, feature)) {
      throw new ForbiddenException({
        code: 'LICENSE_FEATURE_LOCKED',
        message: `Funcionalidade «${feature}» não incluída no plano ${tierLabelPt(tier)}`,
        tier,
        feature,
      });
    }
  }

  resolveLicenseKeyFromEnv(): string | null {
    const inline = this.config.get<string>('EASYSIGNAGE_LICENSE_KEY')?.trim();
    if (inline) return inline;
    const filePath =
      this.config.get<string>('EASYSIGNAGE_LICENSE_FILE') ?? '/config/license.key';
    return this.readText(filePath);
  }

  private async countActivePlayers(): Promise<number> {
    return this.prisma.device.count({ where: { status: 'active' } });
  }

  private async buildStatus(
    tier: LicenseTier,
    licensed: boolean,
    message: string | null,
    extra?: {
      issuedAt?: Date | null;
      expiresAt?: Date | null;
      customer?: string | null;
    }
  ): Promise<LicenseStatus> {
    const hardwareId = this.resolveHardwareId();
    const maxPlayers = tierMaxPlayers(tier);
    const usedPlayers = await this.countActivePlayers();
    return {
      hardwareId,
      tier,
      maxPlayers,
      usedPlayers,
      valid: licensed || tier === 'TRIAL',
      licensed,
      issuedAt: extra?.issuedAt?.toISOString() ?? null,
      expiresAt: extra?.expiresAt?.toISOString() ?? null,
      customer: extra?.customer ?? null,
      message,
      features: [...tierFeatures(tier)],
    };
  }

  async refreshFromEnvironment(): Promise<LicenseStatus> {
    const hardwareId = this.resolveHardwareId();
    const serial = this.resolveLicenseKeyFromEnv();
    const publicKey = this.resolvePublicKeyPem();

    if (!serial) {
      const status = await this.buildStatus(
        'TRIAL',
        false,
        'Instalação em modo trial. Insira uma licença válida.'
      );
      await this.persistState(hardwareId, 'TRIAL', null, status);
      this.cachedStatus = status;
      return status;
    }

    const verified = verifyLicense(serial, publicKey);
    if (!verified.ok) {
      const status = await this.buildStatus('TRIAL', false, verified.reason);
      await this.persistState(hardwareId, 'TRIAL', serial, status);
      this.cachedStatus = status;
      this.logger.warn(`Licença inválida: ${verified.reason}`);
      return status;
    }

    const payload = verified.payload;
    if (payload.hwid !== hardwareId) {
      const status = await this.buildStatus(
        'TRIAL',
        false,
        'Licença não corresponde ao Hardware ID desta instalação'
      );
      await this.persistState(hardwareId, 'TRIAL', serial, status);
      this.cachedStatus = status;
      return status;
    }

    const status = await this.buildStatus(payload.tier, true, null, {
      issuedAt: new Date(payload.issuedAt),
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      customer: payload.customer ?? null,
    });
    await this.persistState(
      hardwareId,
      payload.tier,
      serial,
      status,
      {
        issuedAt: new Date(payload.issuedAt),
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        customer: payload.customer ?? null,
      }
    );
    this.cachedStatus = status;
    this.logger.log(
      `Licença activa: ${tierLabelPt(payload.tier)} (${status.usedPlayers}/${status.maxPlayers} players)`
    );
    return status;
  }

  private async persistState(
    hardwareId: string,
    tier: LicenseTier,
    licenseKey: string | null,
    status: LicenseStatus,
    extra?: {
      issuedAt?: Date | null;
      expiresAt?: Date | null;
      customer?: string | null;
    }
  ): Promise<void> {
    await this.prisma.licenseState.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        hardwareId,
        tier,
        maxPlayers: tierMaxPlayers(tier),
        licenseKey,
        customer: extra?.customer ?? null,
        issuedAt: extra?.issuedAt ?? null,
        expiresAt: extra?.expiresAt ?? null,
      },
      update: {
        hardwareId,
        tier,
        maxPlayers: tierMaxPlayers(tier),
        licenseKey,
        customer: extra?.customer ?? null,
        issuedAt: extra?.issuedAt ?? null,
        expiresAt: extra?.expiresAt ?? null,
        lastValidated: new Date(),
      },
    });
    void status;
  }

  async getStatus(): Promise<LicenseStatus> {
    if (this.cachedStatus) {
      const usedPlayers = await this.countActivePlayers();
      return { ...this.cachedStatus, usedPlayers };
    }
    return this.refreshFromEnvironment();
  }

  async applyLicenseKey(licenseKey: string): Promise<LicenseStatus> {
    const trimmed = licenseKey.trim();
    if (!trimmed) {
      throw new BadRequestException('Serial vazio');
    }

    const hardwareId = this.resolveHardwareId();
    const publicKey = this.resolvePublicKeyPem();
    const verified = verifyLicense(trimmed, publicKey);
    if (!verified.ok) {
      throw new BadRequestException(verified.reason);
    }
    if (verified.payload.hwid !== hardwareId) {
      throw new BadRequestException(
        'Licença não corresponde ao Hardware ID desta instalação'
      );
    }

    const licenseFile =
      this.config.get<string>('EASYSIGNAGE_LICENSE_FILE') ?? '/config/license.key';
    try {
      mkdirSync(dirname(licenseFile), { recursive: true });
      writeFileSync(licenseFile, `${trimmed}\n`, 'utf8');
    } catch (err) {
      this.logger.warn(
        `Não foi possível gravar ${licenseFile}: ${err instanceof Error ? err.message : err}`
      );
    }

    process.env.EASYSIGNAGE_LICENSE_KEY = trimmed;
    return this.refreshFromEnvironment();
  }

  async assertCanPairAnotherDevice(): Promise<void> {
    const status = await this.getStatus();
    if (status.usedPlayers >= status.maxPlayers) {
      throw new ForbiddenException({
        code: 'LICENSE_PLAYER_LIMIT',
        message: `Limite de players atingido (${status.usedPlayers}/${status.maxPlayers}) — plano ${tierLabelPt(status.tier)}`,
        tier: status.tier,
        maxPlayers: status.maxPlayers,
        usedPlayers: status.usedPlayers,
      });
    }
  }
}
