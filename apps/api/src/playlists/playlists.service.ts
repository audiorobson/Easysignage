import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CreatePlaylistItemDto } from './dto/create-playlist-item.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';

const ASSET_SELECT = {
  id: true,
  name: true,
  kind: true,
  mimeType: true,
  remoteUrl: true,
} as const;

@Injectable()
export class PlaylistsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.playlist.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      itemCount: r._count.items,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getById(tenantId: string, id: string) {
    const p = await this.prisma.playlist.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            asset: { select: ASSET_SELECT },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Playlist não encontrada');
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      items: p.items.map((it) => ({
        id: it.id,
        position: it.position,
        durationSec: it.durationSec,
        createdAt: it.createdAt,
        asset: it.asset,
      })),
    };
  }

  create(tenantId: string, dto: CreatePlaylistDto) {
    return this.prisma.playlist.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
      include: { _count: { select: { items: true } } },
    }).then((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      itemCount: r._count.items,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async update(tenantId: string, id: string, dto: UpdatePlaylistDto) {
    await this.ensurePlaylist(tenantId, id);
    const p = await this.prisma.playlist.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.status != null ? { status: dto.status.trim() } : {}),
      },
      include: { _count: { select: { items: true } } },
    });
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      itemCount: p._count.items,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async remove(tenantId: string, id: string) {
    await this.ensurePlaylist(tenantId, id);
    await this.prisma.playlist.delete({ where: { id } });
    return { ok: true };
  }

  async addItem(
    tenantId: string,
    playlistId: string,
    dto: CreatePlaylistItemDto
  ) {
    await this.ensurePlaylist(tenantId, playlistId);
    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.assetId, tenantId },
    });
    if (!asset) throw new NotFoundException('Asset não encontrado');

    const agg = await this.prisma.playlistItem.aggregate({
      where: { playlistId },
      _max: { position: true },
    });
    const position = (agg._max.position ?? -1) + 1;

    const item = await this.prisma.playlistItem.create({
      data: {
        playlistId,
        assetId: dto.assetId,
        position,
        durationSec: dto.durationSec ?? null,
      },
      include: { asset: { select: ASSET_SELECT } },
    });

    return {
      id: item.id,
      position: item.position,
      durationSec: item.durationSec,
      createdAt: item.createdAt,
      asset: item.asset,
    };
  }

  async updateItem(
    tenantId: string,
    playlistId: string,
    itemId: string,
    dto: UpdatePlaylistItemDto
  ) {
    await this.ensurePlaylist(tenantId, playlistId);
    const item = await this.prisma.playlistItem.findFirst({
      where: { id: itemId, playlistId },
      include: { asset: { select: ASSET_SELECT } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    const updated = await this.prisma.playlistItem.update({
      where: { id: itemId },
      data: {
        ...(dto.durationSec !== undefined
          ? { durationSec: dto.durationSec }
          : {}),
      },
      include: { asset: { select: ASSET_SELECT } },
    });

    return {
      id: updated.id,
      position: updated.position,
      durationSec: updated.durationSec,
      createdAt: updated.createdAt,
      asset: updated.asset,
    };
  }

  async removeItem(tenantId: string, playlistId: string, itemId: string) {
    await this.ensurePlaylist(tenantId, playlistId);
    const item = await this.prisma.playlistItem.findFirst({
      where: { id: itemId, playlistId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    await this.prisma.playlistItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async reorder(
    tenantId: string,
    playlistId: string,
    orderedItemIds: string[]
  ) {
    await this.ensurePlaylist(tenantId, playlistId);
    const existing = await this.prisma.playlistItem.findMany({
      where: { playlistId },
      select: { id: true },
    });
    const idSet = new Set(existing.map((e) => e.id));
    if (orderedItemIds.length !== existing.length) {
      throw new BadRequestException(
        'orderedItemIds deve conter todos os itens da playlist'
      );
    }
    if (!orderedItemIds.every((id) => idSet.has(id))) {
      throw new BadRequestException('IDs inválidos ou de outra playlist');
    }

    const offset = 100000;
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedItemIds.length; i++) {
        await tx.playlistItem.update({
          where: { id: orderedItemIds[i] },
          data: { position: offset + i },
        });
      }
      for (let i = 0; i < orderedItemIds.length; i++) {
        await tx.playlistItem.update({
          where: { id: orderedItemIds[i] },
          data: { position: i },
        });
      }
    });

    return this.getById(tenantId, playlistId);
  }

  /** Ordem e metadados para o web player (auth por device). Sem ficheiros binários. */
  async getManifestForDevice(tenantId: string, playlistId: string) {
    const p = await this.prisma.playlist.findFirst({
      where: { id: playlistId, tenantId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                kind: true,
                remoteUrl: true,
                fileSize: true,
              },
            },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Playlist não encontrada');
    const items = p.items.map((i) => ({
      itemId: i.id,
      position: i.position,
      durationSec: i.durationSec,
      assetId: i.asset.id,
      mimeType: i.asset.mimeType,
      kind: i.asset.kind,
      remoteUrl: i.asset.remoteUrl,
      fileSize: i.asset.fileSize.toString(),
    }));
    const manifestRevision = createHash('sha256')
      .update(
        `${p.id}|${p.updatedAt.toISOString()}|${JSON.stringify(
          p.items.map((i) => [i.id, i.position, i.assetId])
        )}`
      )
      .digest('hex')
      .slice(0, 24);
    return {
      playlistId: p.id,
      name: p.name,
      manifestRevision,
      items,
    };
  }

  private async ensurePlaylist(tenantId: string, id: string) {
    const pl = await this.prisma.playlist.findFirst({ where: { id, tenantId } });
    if (!pl) throw new NotFoundException('Playlist não encontrada');
    return pl;
  }
}
