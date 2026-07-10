import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);
import type { FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import {
  inferKindFromMime,
  resolveMimeAndExt,
} from '@easysignage/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = Math.min(
  Number(process.env.ASSET_MAX_BYTES) || 100 * 1024 * 1024,
  500 * 1024 * 1024
);

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private storageRoot(): string {
    return process.env.STORAGE_ROOT ?? join(process.cwd(), 'uploads');
  }

  absPath(storageKey: string): string {
    return join(this.storageRoot(), storageKey);
  }

  async list(tenantId: string, kindFilter?: string) {
    const rows = await this.prisma.asset.findMany({
      where: {
        tenantId,
        ...(kindFilter?.trim() ? { kind: kindFilter.trim() } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        kind: true,
        mimeType: true,
        remoteUrl: true,
        thumbnailKey: true,
        fileSize: true,
        status: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      fileSize: r.fileSize.toString(),
    }));
  }

  async create(tenantId: string, dto: CreateAssetDto) {
    const url = dto.remoteUrl?.trim();
    if (url) {
      return this.createUrlAsset(tenantId, dto.name.trim(), url);
    }
    if (!dto.mimeType?.trim() || !dto.dataBase64?.trim()) {
      throw new BadRequestException(
        'Informe remoteUrl (URL externa) ou mimeType + dataBase64 (ficheiro)'
      );
    }
    return this.createFromBase64(tenantId, {
      name: dto.name,
      mimeType: dto.mimeType,
      dataBase64: dto.dataBase64,
    });
  }

  /** Upload multipart (campo `file`; opcional campo `name`). */
  async createFromMultipart(tenantId: string, req: FastifyRequest) {
    let buf: Buffer | null = null;
    let filename = 'upload.bin';
    let mimetype = 'application/octet-stream';
    let nameField: string | null = null;

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        buf = await part.toBuffer();
        filename = part.filename || filename;
        mimetype = part.mimetype || mimetype;
      } else if (part.fieldname === 'name') {
        nameField = String(part.value ?? '').trim() || null;
      }
    }

    if (!buf?.length) {
      throw new BadRequestException(
        'Envie um ficheiro no campo file (multipart/form-data)'
      );
    }

    const name = (nameField || filename).trim() || 'upload';
    return this.persistBufferAsset(tenantId, name, mimetype, buf);
  }

  private async createUrlAsset(tenantId: string, name: string, rawUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('URL inválida');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('Use http ou https');
    }

    const asset = await this.prisma.asset.create({
      data: {
        tenantId,
        name,
        kind: 'url',
        mimeType: 'application/x-easysignage-url',
        storageKey: null,
        remoteUrl: parsed.toString(),
        thumbnailKey: null,
        fileSize: 0n,
        status: 'ready',
      },
      select: {
        id: true,
        name: true,
        kind: true,
        mimeType: true,
        remoteUrl: true,
        thumbnailKey: true,
        fileSize: true,
        status: true,
        createdAt: true,
      },
    });
    return { ...asset, fileSize: asset.fileSize.toString() };
  }

  private async createFromBase64(
    tenantId: string,
    dto: { name: string; mimeType: string; dataBase64: string }
  ) {
    let b64 = dto.dataBase64.trim();
    const dataUrl = /^data:[^;]+;base64,(.+)$/is.exec(b64);
    if (dataUrl) b64 = dataUrl[1] ?? b64;

    let buf: Buffer;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch {
      throw new BadRequestException('Base64 inválido');
    }
    if (buf.length === 0) throw new BadRequestException('Arquivo vazio');

    return this.persistBufferAsset(
      tenantId,
      dto.name.trim(),
      dto.mimeType,
      buf
    );
  }

  /** Grava ficheiro, gera miniatura para imagens raster, persiste asset. */
  private async persistBufferAsset(
    tenantId: string,
    rawName: string,
    rawMime: string,
    buf: Buffer
  ) {
    const resolved = resolveMimeAndExt(rawMime, rawName);
    if (!resolved) {
      throw new BadRequestException(
        'Tipo de ficheiro não suportado. Formatos: imagens (PNG, JPEG, GIF, WebP, SVG, AVIF, TIFF…), vídeo (MP4, WebM, MOV…), áudio (MP3, WAV, AAC…), PDF, HTML e texto.'
      );
    }
    const { mimeType, ext } = resolved;
    const kind = inferKindFromMime(mimeType);
    const maxBytes =
      kind === 'image' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
    if (buf.length > maxBytes) {
      throw new BadRequestException(
        `Ficheiro acima do limite (${maxBytes} bytes para este tipo)`
      );
    }

    const id = randomUUID();
    const storageKey = join(tenantId, `${id}.${ext}`).replace(/\\/g, '/');
    const dir = join(this.storageRoot(), tenantId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.absPath(storageKey), buf);

    let thumbnailKey: string | null = null;
    if (kind === 'image') {
      thumbnailKey = await this.tryWriteImageThumbnail(tenantId, id, buf);
    } else if (kind === 'video') {
      thumbnailKey = await this.tryWriteVideoThumbnail(
        tenantId,
        id,
        this.absPath(storageKey)
      );
    }

    const asset = await this.prisma.asset.create({
      data: {
        id,
        tenantId,
        name: rawName.trim(),
        kind,
        mimeType,
        storageKey,
        remoteUrl: null,
        thumbnailKey,
        fileSize: BigInt(buf.length),
        status: 'ready',
      },
      select: {
        id: true,
        name: true,
        kind: true,
        mimeType: true,
        remoteUrl: true,
        thumbnailKey: true,
        fileSize: true,
        status: true,
        createdAt: true,
      },
    });

    return { ...asset, fileSize: asset.fileSize.toString() };
  }

  /** JPEG ~320px para pré-visualização CMS; falha silenciosa (SVG, corruptos). */
  private async tryWriteImageThumbnail(
    tenantId: string,
    assetId: string,
    buf: Buffer
  ): Promise<string | null> {
    const thumbName = `${assetId}_thumb.jpg`;
    const thumbnailKey = join(tenantId, thumbName).replace(/\\/g, '/');
    const abs = this.absPath(thumbnailKey);
    try {
      await sharp(buf)
        .rotate()
        .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(abs);
      return thumbnailKey;
    } catch {
      try {
        await unlink(abs);
      } catch {
        /* ignore */
      }
      return null;
    }
  }

  /**
   * Frame ~1s → JPEG (requer `ffmpeg` no PATH ou FFMPEG_PATH). Falha silenciosa.
   */
  private async tryWriteVideoThumbnail(
    tenantId: string,
    assetId: string,
    videoAbsPath: string
  ): Promise<string | null> {
    const thumbName = `${assetId}_thumb.jpg`;
    const thumbnailKey = join(tenantId, thumbName).replace(/\\/g, '/');
    const absOut = this.absPath(thumbnailKey);
    const ffmpeg =
      process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
    if (!existsSync(videoAbsPath)) return null;
    try {
      await execFileAsync(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          videoAbsPath,
          '-ss',
          '00:00:01',
          '-vframes',
          '1',
          '-vf',
          'scale=320:-2',
          absOut,
        ],
        { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
      );
      return thumbnailKey;
    } catch {
      try {
        await unlink(absOut);
      } catch {
        /* ignore */
      }
      return null;
    }
  }

  async update(tenantId: string, assetId: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) throw new NotFoundException('Asset não encontrado');

    const hasName = dto.name != null && dto.name.trim() !== '';
    const hasUrl = dto.remoteUrl != null && dto.remoteUrl.trim() !== '';
    if (!hasName && !hasUrl) {
      throw new BadRequestException('Informe name e/ou remoteUrl');
    }

    if (dto.remoteUrl != null && dto.remoteUrl.trim() !== '') {
      if (asset.kind !== 'url') {
        throw new BadRequestException(
          'Só assets do tipo URL podem alterar o endereço remoto'
        );
      }
    }

    let remoteUrl: string | undefined;
    if (hasUrl) {
      let parsed: URL;
      try {
        parsed = new URL(dto.remoteUrl!.trim());
      } catch {
        throw new BadRequestException('URL inválida');
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new BadRequestException('Use http ou https');
      }
      remoteUrl = parsed.toString();
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(hasName ? { name: dto.name!.trim() } : {}),
        ...(remoteUrl !== undefined ? { remoteUrl } : {}),
      },
      select: {
        id: true,
        name: true,
        kind: true,
        mimeType: true,
        remoteUrl: true,
        thumbnailKey: true,
        fileSize: true,
        status: true,
        createdAt: true,
      },
    });
    return { ...updated, fileSize: updated.fileSize.toString() };
  }

  async remove(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) throw new NotFoundException('Asset não encontrado');

    try {
      await this.prisma.asset.delete({ where: { id: assetId } });
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'P2003') {
        throw new ConflictException(
          'Não é possível remover: o asset está em uso (ex.: numa playlist).'
        );
      }
      throw e;
    }

    if (asset.storageKey) {
      try {
        await unlink(this.absPath(asset.storageKey));
      } catch {
        /* ficheiro já inexistente */
      }
    }
    if (asset.thumbnailKey) {
      try {
        await unlink(this.absPath(asset.thumbnailKey));
      } catch {
        /* ignore */
      }
    }
  }

  /** Miniatura JPEG para biblioteca CMS (autenticado). */
  async streamThumbnailForTenant(
    tenantId: string,
    assetId: string,
    reply: FastifyReply
  ): Promise<void> {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      select: { thumbnailKey: true },
    });
    if (!asset?.thumbnailKey) {
      reply.code(404).send({ message: 'Miniatura indisponível' });
      return;
    }
    const abs = this.absPath(asset.thumbnailKey);
    reply
      .type('image/jpeg')
      .header('Cache-Control', 'private, max-age=86400');
    return reply.send(createReadStream(abs));
  }

  async getMetaForTenant(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      select: {
        id: true,
        name: true,
        kind: true,
        mimeType: true,
        remoteUrl: true,
      },
    });
    if (!asset) throw new NotFoundException('Asset não encontrado');
    return asset;
  }

  /**
   * Stream local file ou redireciona para `remoteUrl` (asset só-URL).
   */
  async sendFileForDevice(
    tenantId: string,
    assetId: string,
    reply: FastifyReply
  ): Promise<void> {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) {
      reply.code(404).send({ message: 'Asset não encontrado' });
      return;
    }

    if (asset.remoteUrl && !asset.storageKey) {
      return reply.redirect(asset.remoteUrl, 302);
    }

    if (!asset.storageKey) {
      reply.code(404).send({ message: 'Asset sem ficheiro' });
      return;
    }

    const abs = this.absPath(asset.storageKey);
    reply
      .header('Content-Type', asset.mimeType)
      .header(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(asset.name)}"`
      );
    return reply.send(createReadStream(abs));
  }

  /** CMS / download interno (JWT) — stream apenas ficheiro local */
  async streamFileForTenant(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) throw new NotFoundException('Asset não encontrado');
    if (!asset.storageKey) {
      throw new BadRequestException(
        'Este asset é uma URL externa — abra remoteUrl no cliente'
      );
    }
    const abs = this.absPath(asset.storageKey);
    return new StreamableFile(createReadStream(abs), {
      type: asset.mimeType,
      disposition: `inline; filename="${encodeURIComponent(asset.name)}"`,
    });
  }
}
