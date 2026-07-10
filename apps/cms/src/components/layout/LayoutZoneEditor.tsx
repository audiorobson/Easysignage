'use client';

import { useMemo, useState } from 'react';
import {
  CONTENT_FIT_MODES,
  contentFitLabelPt,
  layoutZoneStyle,
  type LayoutTemplateZone,
  type LayoutZoneFrame,
} from '@easysignage/shared-types';
import { PlaylistEmbedPlayer } from '@/components/PlaylistEmbedPlayer';
import {
  defaultZoneDisplay,
  canvasAspectRatio,
  sortZonesForCanvas,
  zoneColor,
  collectGuideLines,
  snapFrame,
  clampFrame,
  framesEqual,
  LAYOUT_GRID_STEP,
  type ZoneDisplayEditor,
} from '@/lib/layout-editor';

export type LayoutTemplateOption = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  zonesJson: LayoutTemplateZone[];
};

type Props = {
  templates: LayoutTemplateOption[];
  playlists: { id: string; name: string }[];
  templateId: string;
  onTemplateIdChange: (id: string) => void;
  zonePlaylistIds: Record<string, string>;
  onZonePlaylistChange: (zoneId: string, playlistId: string) => void;
  zoneDisplay: Record<string, ZoneDisplayEditor>;
  onZoneDisplayChange: (zoneId: string, editor: ZoneDisplayEditor) => void;
  zoneFrames: Record<string, LayoutZoneFrame>;
  templateFrames: Record<string, LayoutZoneFrame>;
  onZoneFrameChange: (zoneId: string, frame: LayoutZoneFrame) => void;
  viewportWidth: number;
  viewportHeight: number;
  displayOrientation: string;
  accessToken: string;
  saving?: boolean;
  assigning?: boolean;
  publishing?: boolean;
  canApply?: boolean;
  onSave: () => void;
  onApplyTest: () => void;
  onPublish: () => void;
  activeRevision?: string | null;
};

export function LayoutZoneEditor({
  templates,
  playlists,
  templateId,
  onTemplateIdChange,
  zonePlaylistIds,
  onZonePlaylistChange,
  zoneDisplay,
  onZoneDisplayChange,
  zoneFrames,
  templateFrames,
  onZoneFrameChange,
  viewportWidth,
  viewportHeight,
  displayOrientation,
  accessToken,
  saving,
  assigning,
  publishing,
  canApply,
  onSave,
  onApplyTest,
  onPublish,
  activeRevision,
}: Props) {
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);

  const zonesWithFrames = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.zonesJson.map((z) => ({
      ...z,
      frame: zoneFrames[z.zoneId] ?? z.frame,
    }));
  }, [selectedTemplate, zoneFrames]);

  const sortedZones = useMemo(
    () => sortZonesForCanvas(zonesWithFrames),
    [zonesWithFrames]
  );

  const effectiveSelected =
    selectedZoneId && sortedZones.some((z) => z.zoneId === selectedZoneId)
      ? selectedZoneId
      : sortedZones[0]?.zoneId ?? null;

  const guideLines = useMemo(
    () => (showGuides ? collectGuideLines(zonesWithFrames, effectiveSelected ?? undefined) : []),
    [zonesWithFrames, showGuides, effectiveSelected]
  );

  const selectedZone = sortedZones.find((z) => z.zoneId === effectiveSelected);
  const selectedEditor = effectiveSelected
    ? (zoneDisplay[effectiveSelected] ?? defaultZoneDisplay())
    : null;
  const selectedPlaylistId = effectiveSelected ? zonePlaylistIds[effectiveSelected] ?? '' : '';

  const aspect = canvasAspectRatio(viewportWidth, viewportHeight, displayOrientation);

  const playlistMap = useMemo(
    () => new Map(playlists.map((p) => [p.id, p.name])),
    [playlists]
  );

  return (
    <div className="layout-editor">
      <section className="layout-editor__gallery" aria-label="Galeria de templates">
        <h3 className="layout-editor__section-title">Template</h3>
        <div className="layout-editor__template-grid">
          {templates.map((t) => {
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                className={`layout-editor__template-card${active ? ' is-active' : ''}`}
                onClick={() => {
                  onTemplateIdChange(t.id);
                  setSelectedZoneId(t.zonesJson[0]?.zoneId ?? null);
                }}
              >
                <div className="layout-editor__template-thumb" aria-hidden>
                  {sortZonesForCanvas(t.zonesJson).map((z, i) => (
                    <span
                      key={z.zoneId}
                      className="layout-editor__template-zone"
                      style={{
                        ...layoutZoneStyle(z.frame),
                        background: `${zoneColor(i)}22`,
                        borderColor: zoneColor(i),
                      }}
                    />
                  ))}
                </div>
                <span className="layout-editor__template-name">{t.name}</span>
                {t.description && (
                  <span className="layout-editor__template-desc">{t.description}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {!selectedTemplate ? (
        <p className="text-muted">Selecione um template para editar as zonas.</p>
      ) : (
        <div className="layout-editor__workspace">
          <div className="layout-editor__canvas-col">
            <div className="layout-editor__canvas-header">
              <h3 className="layout-editor__section-title" style={{ margin: 0 }}>
                Canvas — {viewportWidth}×{viewportHeight}
              </h3>
              <div className="layout-editor__canvas-tools">
                <label className="layout-editor__toggle">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                  Grelha {LAYOUT_GRID_STEP}%
                </label>
                <label className="layout-editor__toggle">
                  <input
                    type="checkbox"
                    checked={showGuides}
                    onChange={(e) => setShowGuides(e.target.checked)}
                  />
                  Guias
                </label>
              </div>
            </div>
            <div
              className="layout-editor__canvas-wrap"
              style={{ aspectRatio: String(aspect) }}
            >
              <div className={`layout-editor__canvas${showGrid ? ' has-grid' : ''}`}>
                {showGuides &&
                  guideLines.map((pct) => (
                    <span
                      key={`v-${pct}`}
                      className="layout-editor__guide layout-editor__guide--v"
                      style={{ left: `${pct}%` }}
                      aria-hidden
                    />
                  ))}
                {showGuides &&
                  guideLines.map((pct) => (
                    <span
                      key={`h-${pct}`}
                      className="layout-editor__guide layout-editor__guide--h"
                      style={{ top: `${pct}%` }}
                      aria-hidden
                    />
                  ))}
                {sortedZones.map((z, i) => {
                  const plId = zonePlaylistIds[z.zoneId] ?? '';
                  const plName = plId ? playlistMap.get(plId) : null;
                  const isSelected = z.zoneId === effectiveSelected;
                  const color = zoneColor(
                    selectedTemplate.zonesJson.findIndex((x) => x.zoneId === z.zoneId)
                  );
                  return (
                    <button
                      key={z.zoneId}
                      type="button"
                      className={`layout-editor__zone${isSelected ? ' is-selected' : ''}${plId ? ' has-content' : ''}`}
                      style={{
                        ...layoutZoneStyle(z.frame),
                        ['--zone-color' as string]: color,
                      }}
                      onClick={() => setSelectedZoneId(z.zoneId)}
                      title={`${z.label} — ${z.frame.w}%×${z.frame.h}%`}
                    >
                      <span className="layout-editor__zone-label">{z.label}</span>
                      <span className="layout-editor__zone-meta">
                        {plName ?? 'Sem playlist'}
                      </span>
                      <span className="layout-editor__zone-pct">
                        {z.frame.x},{z.frame.y} · {z.frame.w}×{z.frame.h}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="layout-editor__inspector">
            {selectedZone && selectedEditor && (
              <>
                <h3 className="layout-editor__section-title">{selectedZone.label}</h3>
                <p className="text-muted" style={{ marginTop: 0, fontSize: 13 }}>
                  Zona <code>{selectedZone.zoneId}</code> — {selectedZone.frame.w}% ×{' '}
                  {selectedZone.frame.h}%
                </p>

                <label className="field">
                  <span>Playlist</span>
                  <select
                    className="select"
                    value={selectedPlaylistId}
                    onChange={(e) =>
                      onZonePlaylistChange(selectedZone.zoneId, e.target.value)
                    }
                  >
                    <option value="">(vazio)</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Modo de exibição</span>
                  <select
                    className="select"
                    value={selectedEditor.fit}
                    onChange={(e) =>
                      onZoneDisplayChange(selectedZone.zoneId, {
                        ...selectedEditor,
                        fit: e.target.value as ZoneDisplayEditor['fit'],
                      })
                    }
                  >
                    {CONTENT_FIT_MODES.map((f) => (
                      <option key={f} value={f}>
                        {contentFitLabelPt(f)}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="layout-editor__frame-fieldset">
                  <legend>Geometria (%)</legend>
                  <p className="text-muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
                    Snap automático a {LAYOUT_GRID_STEP}% e bordas de outras zonas.
                  </p>
                  <div className="layout-editor__frame-grid">
                    {(['x', 'y', 'w', 'h'] as const).map((key) => (
                      <label key={key} className="field">
                        <span>{key.toUpperCase()}</span>
                        <input
                          type="number"
                          className="input"
                          min={key === 'x' || key === 'y' ? 0 : 1}
                          max={100}
                          step={LAYOUT_GRID_STEP}
                          value={selectedZone.frame[key]}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            if (!Number.isFinite(raw)) return;
                            const next = { ...selectedZone.frame, [key]: raw };
                            const guides = collectGuideLines(
                              zonesWithFrames,
                              selectedZone.zoneId
                            );
                            onZoneFrameChange(
                              selectedZone.zoneId,
                              snapFrame(clampFrame(next), guides)
                            );
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  {templateFrames[selectedZone.zoneId] &&
                    !framesEqual(
                      selectedZone.frame,
                      templateFrames[selectedZone.zoneId]!
                    ) && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ marginTop: 8, fontSize: 12 }}
                        onClick={() =>
                          onZoneFrameChange(
                            selectedZone.zoneId,
                            templateFrames[selectedZone.zoneId]!
                          )
                        }
                      >
                        Repor geometria do template
                      </button>
                    )}
                </fieldset>

                <div className="layout-editor__target-row">
                  <label className="field">
                    <span>Largura alvo (px)</span>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      max={7680}
                      placeholder="Opcional"
                      value={selectedEditor.targetWidth}
                      onChange={(e) =>
                        onZoneDisplayChange(selectedZone.zoneId, {
                          ...selectedEditor,
                          targetWidth: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Altura alvo (px)</span>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      max={7680}
                      placeholder="Opcional"
                      value={selectedEditor.targetHeight}
                      onChange={(e) =>
                        onZoneDisplayChange(selectedZone.zoneId, {
                          ...selectedEditor,
                          targetHeight: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                {selectedPlaylistId ? (
                  <div className="layout-editor__preview">
                    <span className="layout-editor__preview-label">Pré-visualização</span>
                    <PlaylistEmbedPlayer
                      playlistId={selectedPlaylistId}
                      accessToken={accessToken}
                    />
                  </div>
                ) : (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Escolha uma playlist para pré-visualizar o conteúdo desta zona.
                  </p>
                )}
              </>
            )}

            <div className="layout-editor__actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!templateId || saving}
                onClick={onSave}
              >
                {saving ? 'A guardar…' : 'Guardar layout'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canApply || assigning || publishing}
                onClick={onApplyTest}
              >
                {assigning ? 'A aplicar…' : 'Aplicar teste'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canApply || assigning || publishing}
                onClick={onPublish}
              >
                {publishing ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
            {activeRevision && (
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 0 }}>
                Revisão ativa: <code>{activeRevision}</code>
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
