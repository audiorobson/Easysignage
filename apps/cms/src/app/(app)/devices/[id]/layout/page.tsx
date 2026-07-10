'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LayoutZoneEditor } from '@/components/layout/LayoutZoneEditor';
import {
  buildDisplayBody,
  defaultZoneDisplay,
  displayFromJson,
  type ZoneDisplayEditor,
} from '@/lib/layout-editor';
import { api, getToken } from '@/lib/api';
import type { LayoutTemplateZone, LayoutZoneFrame } from '@easysignage/shared-types';

type DeviceMask = {
  id: string;
  name: string;
  viewportWidth?: number;
  viewportHeight?: number;
  displayOrientation?: string;
};

type LayoutTemplateRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  zonesJson: LayoutTemplateZone[];
};

type DeviceLayoutRow = {
  id: string;
  templateId: string;
  revision: string;
  zonesJson: {
    zoneId: string;
    source: { type: string; playlistId?: string } | null;
    display?: unknown;
    frame?: LayoutZoneFrame;
  }[];
  template: { id: string; slug: string; name: string; zonesJson: LayoutTemplateZone[] };
};

export default function DeviceLayoutEditorPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [device, setDevice] = useState<DeviceMask | null>(null);
  const [templates, setTemplates] = useState<LayoutTemplateRow[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [deviceLayout, setDeviceLayout] = useState<DeviceLayoutRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [zonePlaylistIds, setZonePlaylistIds] = useState<Record<string, string>>({});
  const [zoneDisplay, setZoneDisplay] = useState<Record<string, ZoneDisplayEditor>>({});
  const [zoneFrames, setZoneFrames] = useState<Record<string, LayoutZoneFrame>>({});
  const [templateFrames, setTemplateFrames] = useState<Record<string, LayoutZoneFrame>>({});
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [dev, layout] = await Promise.all([
      api<DeviceMask>(`/devices/${id}`),
      api<DeviceLayoutRow | null>(`/devices/${id}/layout`).catch(() => null),
    ]);
    setDevice(dev);
    setDeviceLayout(layout);
    if (layout) {
      setTemplateId(layout.templateId);
      const pl: Record<string, string> = {};
      const disp: Record<string, ZoneDisplayEditor> = {};
      const frames: Record<string, LayoutZoneFrame> = {};
      const tplFrames: Record<string, LayoutZoneFrame> = {};
      for (const z of layout.template.zonesJson) {
        tplFrames[z.zoneId] = z.frame;
      }
      for (const b of layout.zonesJson) {
        if (b.source?.type === 'playlist' && b.source.playlistId) {
          pl[b.zoneId] = b.source.playlistId;
        }
        disp[b.zoneId] = displayFromJson(b.display);
        if (b.frame) frames[b.zoneId] = b.frame;
      }
      setZonePlaylistIds(pl);
      setZoneDisplay(disp);
      setZoneFrames(frames);
      setTemplateFrames(tplFrames);
    }
  }, [id]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const [tpl, pl] = await Promise.all([
          api<LayoutTemplateRow[]>('/layout-templates'),
          api<{ id: string; name: string }[]>('/playlists'),
        ]);
        if (cancelled) return;
        setTemplates(tpl);
        setPlaylists(pl);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  function onTemplateChange(nextId: string) {
    setTemplateId(nextId);
    const tpl = templates.find((t) => t.id === nextId);
    if (!tpl) return;
    const pl: Record<string, string> = {};
    const disp: Record<string, ZoneDisplayEditor> = {};
    const tplFrames: Record<string, LayoutZoneFrame> = {};
    for (const z of tpl.zonesJson) {
      pl[z.zoneId] = zonePlaylistIds[z.zoneId] ?? '';
      disp[z.zoneId] = zoneDisplay[z.zoneId] ?? defaultZoneDisplay();
      tplFrames[z.zoneId] = z.frame;
    }
    setZonePlaylistIds(pl);
    setZoneDisplay(disp);
    setZoneFrames({});
    setTemplateFrames(tplFrames);
  }

  async function saveLayout() {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSaving(true);
    setError(null);
    try {
      const bindings = tpl.zonesJson.map((z) => {
        const editor = zoneDisplay[z.zoneId] ?? defaultZoneDisplay();
        const override = zoneFrames[z.zoneId];
        const templateFrame = templateFrames[z.zoneId] ?? z.frame;
        const frameChanged =
          override &&
          (override.x !== templateFrame.x ||
            override.y !== templateFrame.y ||
            override.w !== templateFrame.w ||
            override.h !== templateFrame.h);
        return {
          zoneId: z.zoneId,
          playlistId: zonePlaylistIds[z.zoneId] || undefined,
          display: buildDisplayBody(editor),
          ...(frameChanged ? { frame: override } : {}),
        };
      });
      const saved = await api<DeviceLayoutRow>(`/devices/${id}/layout`, {
        method: 'PUT',
        body: JSON.stringify({ templateId, bindings }),
      });
      setDeviceLayout(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function applyTest() {
    if (!deviceLayout?.id) return;
    setAssigning(true);
    setError(null);
    try {
      await api(`/devices/${id}/test-content`, {
        method: 'PATCH',
        body: JSON.stringify({ layoutId: deviceLayout.id }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setAssigning(false);
    }
  }

  async function publish() {
    if (!deviceLayout?.id) return;
    setPublishing(true);
    setError(null);
    try {
      await api(`/devices/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ layoutId: deviceLayout.id }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setPublishing(false);
    }
  }

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
  const vpW = device?.viewportWidth ?? 1920;
  const vpH = device?.viewportHeight ?? 1080;
  const vpO = device?.displayOrientation ?? 'landscape';

  return (
    <>
      <PageHeader
        title="Editor de zonas"
        lead={
          device
            ? `${device.name} — canvas percentual, playlists e fit por zona`
            : 'A carregar dispositivo…'
        }
        actions={
          <Link href={`/devices/${id}?tab=ecra`} className="btn btn--ghost">
            <ArrowLeft strokeWidth={2} aria-hidden />
            Ecrã & Layout
          </Link>
        }
      />

      {error && <p className="text-danger">{error}</p>}

      {!device || !token ? (
        <p className="text-muted">A carregar editor…</p>
      ) : templates.length === 0 ? (
        <p className="text-muted">Nenhum template disponível.</p>
      ) : (
        <LayoutZoneEditor
          templates={templates}
          playlists={playlists}
          templateId={templateId}
          onTemplateIdChange={onTemplateChange}
          zonePlaylistIds={zonePlaylistIds}
          onZonePlaylistChange={(zoneId, playlistId) =>
            setZonePlaylistIds((prev) => ({ ...prev, [zoneId]: playlistId }))
          }
          zoneDisplay={zoneDisplay}
          onZoneDisplayChange={(zoneId, editor) =>
            setZoneDisplay((prev) => ({ ...prev, [zoneId]: editor }))
          }
          zoneFrames={zoneFrames}
          templateFrames={templateFrames}
          onZoneFrameChange={(zoneId, frame) =>
            setZoneFrames((prev) => ({ ...prev, [zoneId]: frame }))
          }
          viewportWidth={vpW}
          viewportHeight={vpH}
          displayOrientation={vpO}
          accessToken={token}
          saving={saving}
          assigning={assigning}
          publishing={publishing}
          canApply={Boolean(deviceLayout?.id)}
          onSave={() => void saveLayout()}
          onApplyTest={() => void applyTest()}
          onPublish={() => void publish()}
          activeRevision={deviceLayout?.revision ?? null}
        />
      )}

      <p className="text-muted" style={{ fontSize: 13, marginTop: 'var(--space-6)' }}>
        <LayoutGrid size={14} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 6 }} />
        As zonas usam coordenadas em percentagem do ecrã lógico — o player aplica o mesmo
        enquadramento em tempo real.
      </p>
    </>
  );
}
