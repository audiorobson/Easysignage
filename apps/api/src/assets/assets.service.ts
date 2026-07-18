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
  inferRemoteStreamKindFromUrl,
  resolveMimeAndExt,
  validateRemoteStreamUrl,
  type RemoteStreamKind,
} from '@easysignage/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseService } from '../license/license.service';
import { MediaQueueService } from '../queue/media-queue.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

const ASSET_SELECT = {
  id: true,
  name: true,
  kind: true,
  mimeType: true,
  remoteUrl: true,
  thumbnailKey: true,
  fileSize: true,
  status: true,
  width: true,
  height: true,
  durationMs: true,
  videoCodec: true,
  audioCodec: true,
  processedAt: true,
  createdAt: true,
} as const;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = Math.min(
  Number(process.env.ASSET_MAX_BYTES) || 100 * 1024 * 1024,
  500 * 1024 * 1024
);

type AssetSelectResult = {
  fileSize: bigint;
  kind: string;
  processedAt: Date | null;
  [key: string]: unknown;
};

/**
 * Serializa `fileSize` (BigInt) e deriva `processing`: `true` enquanto o
 * `apps/media-worker` (fila `asset.uploaded`, PR 5.14+) ainda não confirmou
 * o processamento de um asset de imagem/vídeo — usado pelo CMS para exibir
 * um indicador de "a processar" em `/assets` até a miniatura/normalização
 * assíncrona terminar. Assets de outros tipos (URL, RTSP, PDF…) nunca
 * entram na fila e por isso nunca aparecem como "a processar".
 */
function presentAsset<T extends AssetSelectResult>(
  asset: T
): Omit<T, 'fileSize'> & { fileSize: string; processing: boolean } {
  const processing =
    (asset.kind === 'image' || asset.kind === 'video') && asset.processedAt === null;
  return { ...asset, fileSize: asset.fileSize.toString(), processing };
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly license: LicenseService,
    private readonly mediaQueue: MediaQueueService
  ) {}

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
      select: ASSET_SELECT,
    });
    return rows.map((r) => presentAsset(r));
  }

  async create(tenantId: string, dto: CreateAssetDto) {
    const url = dto.remoteUrl?.trim();
    if (url) {
      const kind: RemoteStreamKind =
        dto.kind === 'rtsp' || dto.kind === 'url'
          ? dto.kind
          : inferRemoteStreamKindFromUrl(url);
      if (kind === 'rtsp') {
        await this.license.assertFeature('rtsp');
      }
      return this.createRemoteStreamAsset(tenantId, dto.name.trim(), url, kind);
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

  private async createRemoteStreamAsset(
    tenantId: string,
    name: string,
    rawUrl: string,
    kind: RemoteStreamKind
  ) {
    let normalizedUrl: string;
    try {
      normalizedUrl = validateRemoteStreamUrl(rawUrl, kind);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'URL inválida'
      );
    }

    const mimeType =
      kind === 'rtsp'
        ? 'application/x-rtsp-stream'
        : 'application/x-easysignage-url';

    const asset = await this.prisma.asset.create({
      data: {
        tenantId,
        name,
        kind,
        mimeType,
        storageKey: null,
        remoteUrl: normalizedUrl,
        thumbnailKey: null,
        fileSize: 0n,
        status: 'ready',
      },
      select: ASSET_SELECT,
    });
    return presentAsset(asset);
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
    let width: number | null = null;
    let height: number | null = null;
    if (kind === 'image') {
      thumbnailKey = await this.tryWriteImageThumbnail(tenantId, id, buf);
      const dims = await this.tryReadImageDimensions(buf);
      width = dims?.width ?? null;
      height = dims?.height ?? null;
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
        width,
        height,
      },
      select: ASSET_SELECT,
    });

    if (kind === 'image' || kind === 'video') {
      // Best-effort: o worker assíncrono (PR 5.15+) reprocessa thumbnail/metadata;
      // até lá (ou se o Redis estiver indisponível), o pipeline síncrono acima
      // já cobre o caso comum.
      void this.mediaQueue.publishAssetUploaded({
        tenantId,
        assetId: asset.id,
        kind,
      });
    }

    return presentAsset(asset);
  }

  /** Largura/altura em pixels; falha silenciosa (ex.: SVG sem viewBox). */
  private async tryReadImageDimensions(
    buf: Buffer
  ): Promise<{ width: number; height: number } | null> {
    try {
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height) return null;
      return { width: meta.width, height: meta.height };
    } catch {
      return null;
    }
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
      if (asset.kind !== 'url' && asset.kind !== 'rtsp') {
        throw new BadRequestException(
          'Só assets remotos (URL ou RTSP) podem alterar o endereço'
        );
      }
    }

    let remoteUrl: string | undefined;
    if (hasUrl) {
      try {
        remoteUrl = validateRemoteStreamUrl(
          dto.remoteUrl!.trim(),
          asset.kind as RemoteStreamKind
        );
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'URL inválida'
        );
      }
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(hasName ? { name: dto.name!.trim() } : {}),
        ...(remoteUrl !== undefined ? { remoteUrl } : {}),
      },
      select: ASSET_SELECT,
    });
    return presentAsset(updated);
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

    if (asset.kind === 'rtsp') {
      reply.code(400).send({
        code: 'RTSP_DIRECT_PLAY',
        message:
          'Stream RTSP: o player liga diretamente à rede via meta.remoteUrl (sem proxy no servidor)',
      });
      return;
    }

    if (asset.kind === 'url' && asset.remoteUrl && !asset.storageKey) {
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
