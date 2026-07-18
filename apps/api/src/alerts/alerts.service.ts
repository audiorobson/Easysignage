import { Injectable, Optional } from '@nestjs/common';
import { tierHasFeature } from '@easysignage/license-core';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseService } from '../license/license.service';
import { AlertNotificationsService } from '../notifications/alert-notifications.service';

const MONITORING_ONLINE_MS = 5 * 60 * 1000;
const MONITORING_OFFLINE_LONG_MS = 24 * 60 * 60 * 1000;
const PUBLICATION_SYNC_STALE_MS = 10 * 60 * 1000;

function snapshotIndicatesFault(snapshot: Record<string, unknown> | null): boolean {
  if (!snapshot) return false;
  if (snapshot.connected === false) return true;
  if (snapshot.communicationOk === false) return true;
  if (snapshot.networkError === true) return true;
  const pb = snapshot.playback;
  if (pb && typeof pb === 'object') {
    const p = pb as Record<string, unknown>;
    if (p.state === 'error' || p.health === 'error') return true;
  }
  return false;
}

type UpsertInput = {
  tenantId: string;
  deviceId: string;
  alertType: string;
  severity: string;
  title: string;
  message?: string;
};

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly license: LicenseService,
    @Optional() private readonly notifications?: AlertNotificationsService
  ) {}

  async list(tenantId: string, status?: string) {
    const rows = await this.prisma.alert.findMany({
      where: {
        tenantId,
        ...(status === 'all'
          ? {}
          : status
            ? { status }
            : { status: { in: ['open', 'acknowledged'] } }),
      },
      orderBy: [{ lastSeenAt: 'desc' }],
      include: {
        device: { select: { id: true, name: true, site: { select: { name: true } } } },
      },
    });
    return rows.map((r) => this.toRow(r));
  }

  async summary(tenantId: string) {
    const [open, ack, critical] = await Promise.all([
      this.prisma.alert.count({ where: { tenantId, status: 'open' } }),
      this.prisma.alert.count({ where: { tenantId, status: 'acknowledged' } }),
      this.prisma.alert.count({
        where: { tenantId, status: { in: ['open', 'acknowledged'] }, severity: 'critical' },
      }),
    ]);
    return { open, acknowledged: ack, critical, active: open + ack };
  }

  async acknowledge(tenantId: string, userId: string, alertId: string) {
    const row = await this.prisma.alert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!row) return null;
    if (row.status === 'resolved') {
      return this.toRow(
        await this.prisma.alert.findUniqueOrThrow({
          where: { id: alertId },
          include: {
            device: {
              select: { id: true, name: true, site: { select: { name: true } } },
            },
          },
        })
      );
    }
    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'acknowledged',
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
      },
      include: {
        device: { select: { id: true, name: true, site: { select: { name: true } } } },
      },
    });
    return this.toRow(updated);
  }

  async evaluateTenant(tenantId: string) {
    await this.license.assertFeature('alerts');
    const devices = await this.prisma.device.findMany({
      where: { tenantId },
      select: { id: true },
    });
    let evaluated = 0;
    for (const d of devices) {
      await this.evaluateDevice(tenantId, d.id);
      evaluated += 1;
    }
    return { evaluated };
  }

  async evaluateDevice(tenantId: string, deviceId: string) {
    const tier = await this.license.getCurrentTier();
    if (!tierHasFeature(tier, 'alerts')) {
      return { evaluated: false, skipped: true };
    }

    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
      select: {
        id: true,
        name: true,
        lastSeenAt: true,
        state: {
          select: {
            telemetrySnapshotJson: true,
            appliedPublicationVersion: true,
            appliedContentRevision: true,
            appliedAt: true,
            lastSyncAt: true,
            currentPublication: { select: { version: true } },
          },
        },
      },
    });
    if (!device) return;

    const now = Date.now();
    const lastSeen = device.lastSeenAt?.getTime() ?? 0;
    const age = now - lastSeen;
    const snap = device.state?.telemetrySnapshotJson as Record<string, unknown> | null;

    if (age > MONITORING_OFFLINE_LONG_MS) {
      await this.upsertOpen({
        tenantId,
        deviceId,
        alertType: 'device_offline_long',
        severity: 'critical',
        title: `${device.name} — offline prolongado`,
        message: 'Sem heartbeat há mais de 24 horas.',
      });
      await this.resolve(tenantId, deviceId, 'device_offline');
    } else if (age > MONITORING_ONLINE_MS) {
      await this.upsertOpen({
        tenantId,
        deviceId,
        alertType: 'device_offline',
        severity: 'warning',
        title: `${device.name} — offline`,
        message: 'Sem presença recente (últimos 5 minutos).',
      });
      await this.resolve(tenantId, deviceId, 'device_offline_long');
    } else {
      await this.resolve(tenantId, deviceId, 'device_offline');
      await this.resolve(tenantId, deviceId, 'device_offline_long');
    }

    if (snapshotIndicatesFault(snap)) {
      await this.upsertOpen({
        tenantId,
        deviceId,
        alertType: 'playback_fault',
        severity: 'warning',
        title: `${device.name} — falha de reprodução`,
        message: 'Telemetria do player reporta erro ou rede degradada.',
      });
    } else {
      await this.resolve(tenantId, deviceId, 'playback_fault');
    }

    const pubVer = device.state?.currentPublication?.version ?? null;
    const appliedVer = device.state?.appliedPublicationVersion ?? null;
    const appliedAt = device.state?.appliedAt?.getTime() ?? 0;
    const syncStale =
      pubVer != null &&
      (appliedVer == null || appliedVer !== pubVer) &&
      (appliedAt === 0 || now - appliedAt > PUBLICATION_SYNC_STALE_MS) &&
      age <= MONITORING_ONLINE_MS;

    if (syncStale) {
      await this.upsertOpen({
        tenantId,
        deviceId,
        alertType: 'publication_sync_pending',
        severity: 'info',
        title: `${device.name} — publicação não confirmada`,
        message: `Versão publicada ${pubVer} ainda não confirmada pelo player.`,
      });
    } else {
      await this.resolve(tenantId, deviceId, 'publication_sync_pending');
    }
  }

  private async upsertOpen(input: UpsertInput) {
    const now = new Date();
    const existing = await this.prisma.alert.findUnique({
      where: {
        tenantId_deviceId_alertType: {
          tenantId: input.tenantId,
          deviceId: input.deviceId,
          alertType: input.alertType,
        },
      },
    });

    if (!existing) {
      const created = await this.prisma.alert.create({
        data: {
          tenantId: input.tenantId,
          deviceId: input.deviceId,
          alertType: input.alertType,
          severity: input.severity,
          status: 'open',
          title: input.title,
          message: input.message ?? null,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      this.notifyAsync({
        tenantId: input.tenantId,
        deviceId: input.deviceId,
        alertId: created.id,
        alertType: input.alertType,
        severity: input.severity,
        status: 'open',
        title: input.title,
        message: input.message ?? null,
        occurredAt: now.toISOString(),
      });
      return;
    }

    if (existing.status === 'resolved') {
      const updated = await this.prisma.alert.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          status: 'open',
          title: input.title,
          message: input.message ?? null,
          lastSeenAt: now,
          acknowledgedById: null,
          acknowledgedAt: null,
        },
      });
      this.notifyAsync({
        tenantId: input.tenantId,
        deviceId: input.deviceId,
        alertId: updated.id,
        alertType: input.alertType,
        severity: input.severity,
        status: 'open',
        title: input.title,
        message: input.message ?? null,
        occurredAt: now.toISOString(),
      });
      return;
    }

    await this.prisma.alert.update({
      where: { id: existing.id },
      data: {
        severity: input.severity,
        title: input.title,
        message: input.message ?? null,
        lastSeenAt: now,
      },
    });
  }

  private async resolve(tenantId: string, deviceId: string, alertType: string) {
    const toResolve =
      (await this.prisma.alert.findMany({
        where: {
          tenantId,
          deviceId,
          alertType,
          status: { in: ['open', 'acknowledged'] },
        },
      })) ?? [];

    await this.prisma.alert.updateMany({
      where: {
        tenantId,
        deviceId,
        alertType,
        status: { in: ['open', 'acknowledged'] },
      },
      data: { status: 'resolved' },
    });

    const now = new Date().toISOString();
    for (const a of toResolve) {
      this.notifyAsync({
        tenantId,
        deviceId,
        alertId: a.id,
        alertType,
        severity: a.severity,
        status: 'resolved',
        title: a.title,
        message: a.message,
        occurredAt: now,
      });
    }
  }

  /** Fire-and-forget: nunca bloqueia/interrompe a avaliação de alertas (`AlertNotificationsService` já é best-effort por dentro). */
  private notifyAsync(payload: Parameters<AlertNotificationsService['notify']>[0]) {
    void this.notifications?.notify(payload);
  }

  private toRow(
    r: {
      id: string;
      deviceId: string;
      alertType: string;
      severity: string;
      status: string;
      title: string;
      message: string | null;
      firstSeenAt: Date;
      lastSeenAt: Date;
      acknowledgedAt: Date | null;
      device: { id: string; name: string; site: { name: string } };
    }
  ) {
    return {
      id: r.id,
      deviceId: r.deviceId,
      deviceName: r.device.name,
      siteName: r.device.site.name,
      alertType: r.alertType,
      severity: r.severity,
      status: r.status,
      title: r.title,
      message: r.message,
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
    };
  }
}
