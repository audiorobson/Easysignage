'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import { LayoutTemplateModal } from './LayoutTemplateModal';
import { LayoutTemplateThumb } from './LayoutTemplateThumb';
import type { LayoutTemplateRow } from './layout-template-utils';

export default function LayoutTemplatesPage() {
  const router = useRouter();
  const [items, setItems] = useState<LayoutTemplateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<LayoutTemplateRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const data = await api<LayoutTemplateRow[]>('/layout-templates');
    setItems(data);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(row: LayoutTemplateRow) {
    setModalMode('edit');
    setEditing(row);
    setModalOpen(true);
  }

  async function onSave(payload: {
    slug?: string;
    name: string;
    description?: string;
    zonesJson: unknown[];
    sortOrder?: number;
  }) {
    if (modalMode === 'create') {
      await api('/layout-templates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else if (editing) {
      const { slug: _s, ...rest } = payload;
      await api(`/layout-templates/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(rest),
      });
    }
    await load();
  }

  async function deleteConfirmed() {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setDeletingId(id);
    setError(null);
    try {
      await api(`/layout-templates/${id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      setItems((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  const system = items?.filter((t) => t.isSystem) ?? [];
  const custom = items?.filter((t) => !t.isSystem) ?? [];

  return (
    <>
      <PageHeader
        title="Templates de layout"
        lead="Galeria de divisões de ecrã — templates de sistema e custom por tenant (JSON de zonas em percentagem)."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Plus strokeWidth={2.1} aria-hidden />
            Novo template
          </button>
        }
      />

      {error && <p className="text-danger">{error}</p>}
      {!items && !error && <p className="text-muted">A carregar…</p>}

      {items && (
        <>
          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h2 className="layout-editor__section-title">Custom do tenant ({custom.length})</h2>
            {custom.length === 0 ? (
              <p className="text-muted">
                Nenhum template custom. Crie um com JSON de zonas ou importe a partir de um
                template de sistema no editor de device.
              </p>
            ) : (
              <div className="layout-editor__template-grid">
                {custom.map((t) => (
                  <article key={t.id} className="layout-editor__template-card">
                    <LayoutTemplateThumb zones={t.zonesJson} />
                    <span className="layout-editor__template-name">{t.name}</span>
                    <span className="layout-editor__template-desc">
                      <code>{t.slug}</code> · {t.zonesJson.length} zona(s)
                    </span>
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      Atualizado {formatDateTimePtBr(t.updatedAt)}
                    </span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => openEdit(t)}
                      >
                        <Pencil size={14} aria-hidden /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        disabled={deletingId === t.id}
                        onClick={() => setConfirmDelete({ id: t.id, name: t.name })}
                      >
                        <Trash2 size={14} aria-hidden />
                        {deletingId === t.id ? '…' : 'Eliminar'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="layout-editor__section-title">Sistema ({system.length})</h2>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Templates incluídos no produto — só leitura. Use como base para JSON custom.
            </p>
            <div className="layout-editor__template-grid">
              {system.map((t) => (
                <article key={t.id} className="layout-editor__template-card">
                  <LayoutTemplateThumb zones={t.zonesJson} />
                  <span className="layout-editor__template-name">{t.name}</span>
                  {t.description && (
                    <span className="layout-editor__template-desc">{t.description}</span>
                  )}
                  <span className="badge badge--neutral" style={{ alignSelf: 'start', fontSize: 11 }}>
                    Sistema
                  </span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <LayoutTemplateModal
        open={modalOpen}
        mode={modalMode}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSave={onSave}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar template"
        message={
          confirmDelete
            ? `Eliminar «${confirmDelete.name}»? Devices que usam este template devem ser alterados primeiro.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => void deleteConfirmed()}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
