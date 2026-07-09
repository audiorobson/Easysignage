import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';

const MAX_PREVIEW_BYTES = 512 * 1024;

@Injectable()
export class DevicePreviewService {
  constructor(private readonly prisma: PrismaService) {}

  private storageRoot(): string {
    return process.env.STORAGE_ROOT ?? join(process.cwd(), 'uploads');
  }

  absPath(storageKey: string): string {
    return join(this.storageRoot(), storageKey);
  }

  /**
   * Grava JPEG/PNG do player em `previews/{tenant}/{device}/last.jpg` e atualiza `device_state`.
   */
  async saveFromMultipart(
    tenantId: string,
    deviceId: string,
    req: FastifyRequest
  ): Promise<{ previewSnapshotKey: string; previewSnapshotAt: Date }> {
    let buf: Buffer | null = null;
    let mime = 'application/octet-stream';

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        buf = await part.toBuffer();
        mime = part.mimetype || mime;
        break;
      }
    }

    if (!buf?.length) {
      throw new BadRequestException(
        'Envie um ficheiro no campo file (multipart/form-data)'
      );
    }
    if (buf.length > MAX_PREVIEW_BYTES) {
      throw new BadRequestException(
        `Pré-visualização demasiado grande (máx. ${MAX_PREVIEW_BYTES} bytes)`
      );
    }

    const lower = mime.toLowerCase();
    if (
      lower !== 'image/jpeg' &&
      lower !== 'image/jpg' &&
      lower !== 'image/pjpeg' &&
      lower !== 'image/png'
    ) {
      throw new BadRequestException(
        'Use JPEG ou PNG para a pré-visualização'
      );
    }

    const ext = lower.includes('png') ? 'png' : 'jpg';
    const key = `previews/${tenantId}/${deviceId}/last.${ext}`;
    const dir = join(this.storageRoot(), 'previews', tenantId, deviceId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.absPath(key), buf);

    const now = new Date();
    await this.prisma.deviceState.upsert({
      where: { deviceId },
      create: {
        deviceId,
        tenantId,
        previewSnapshotKey: key,
        previewSnapshotAt: now,
      },
      update: {
        previewSnapshotKey: key,
        previewSnapshotAt: now,
      },
    });

    return { previewSnapshotKey: key, previewSnapshotAt: now };
  }

  async assertPreviewReadable(
    tenantId: string,
    deviceId: string
  ): Promise<{ key: string; path: string }> {
    const st = await this.prisma.deviceState.findFirst({
      where: { deviceId, tenantId },
      select: { previewSnapshotKey: true },
    });
    const key = st?.previewSnapshotKey?.trim();
    if (!key) throw new NotFoundException('Sem pré-visualização');

    const path = this.absPath(key);
    if (!existsSync(path)) throw new NotFoundException('Ficheiro em falta');

    return { key, path };
  }

  getReadStream(path: string) {
    return createReadStream(path);
  }
}
