import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RealtimeInternalBroadcast } from '@easysignage/device-protocol';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly gatewayUrl: string | null;
  private readonly secret: string | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('RT_GATEWAY_URL')?.replace(/\/$/, '');
    const secret = config.get<string>('RT_INTERNAL_SECRET')?.trim();
    this.gatewayUrl = url || null;
    this.secret = secret || null;
  }

  get enabled(): boolean {
    return Boolean(this.gatewayUrl && this.secret);
  }

  async broadcastWallSync(input: {
    wallId: string;
    syncEpochMs: number;
    wallRevision: string;
    toleranceMs: number;
  }): Promise<void> {
    await this.post({
      event: 'wall.sync',
      wallId: input.wallId,
      syncEpochMs: input.syncEpochMs,
      wallRevision: input.wallRevision,
      toleranceMs: input.toleranceMs,
    });
  }

  private async post(body: RealtimeInternalBroadcast): Promise<void> {
    if (!this.gatewayUrl || !this.secret) return;
    try {
      const res = await fetch(`${this.gatewayUrl}/internal/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RT-Secret': this.secret,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.warn(`Gateway broadcast falhou: HTTP ${res.status}`);
      }
    } catch (e) {
      this.logger.warn(
        `Gateway indisponível: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}
