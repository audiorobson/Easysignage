'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import {
  EXAMPLE_ZONES_JSON,
  parseZonesJsonText,
  slugifyTemplateName,
  type LayoutTemplateRow,
} from './layout-template-utils';
import { LayoutTemplateThumb } from './LayoutTemplateThumb';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  editing: LayoutTemplateRow | null;
  onClose: () => void;
  onSave: (payload: {
    slug?: string;
    name: string;
    description?: string;
    zonesJson: unknown[];
    sortOrder?: number;
  }) => Promise<void>;
};

export function LayoutTemplateModal({
  open,
  mode,
  editing,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [zonesText, setZonesText] = useState(EXAMPLE_ZONES_JSON);
  const [sortOrder, setSortOrder] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(false);
    if (mode === 'edit' && editing) {
      setName(editing.name);
      setSlug(editing.slug);
      setDescription(editing.description ?? '');
      setZonesText(JSON.stringify(editing.zonesJson, null, 2));
      setSortOrder(editing.sortOrder);
    } else {
      setName('');
      setSlug('');
      setDescription('');
      setZonesText(EXAMPLE_ZONES_JSON);
      setSortOrder(100);
    }
  }, [open, mode, editing]);

  useEffect(() => {
    if (!open || mode !== 'create' || slugTouched) return;
    if (name.trim()) setSlug(slugifyTemplateName(name));
  }, [open, mode, name, slugTouched]);

  const parsed = useMemo(() => parseZonesJsonText(zonesText), [zonesText]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Indique um nome');
      return;
    }
    if (mode === 'create' && !slug.trim()) {
      setError('Indique um slug');
      return;
    }
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...(mode === 'create' ? { slug: slug.trim() } : {}),
        name: name.trim(),
        description: description.trim() || undefined,
        zonesJson: parsed.zones,
        sortOrder,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Novo template de layout' : 'Editar template'}
      titleId="layout-template-modal-title"
      onClose={onClose}
      maxWidth={560}
      scrollable
    >
      <form onSubmit={(e) => void onSubmit(e)}>
        {error && <p className="text-danger" style={{ marginTop: 0 }}>{error}</p>}

        <label className="field">
          <span>Nome</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex.: Loja — faixa + produto"
          />
        </label>

        {mode === 'create' && (
          <label className="field">
            <span>Slug (único)</span>
            <input
              className="input"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              required
              pattern="[a-z][a-z0-9_-]{2,49}"
              placeholder="loja_faixa_produto"
            />
            <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Minúsculas, números, _ e -. Não pode coincidir com templates de sistema.
            </p>
          </label>
        )}

        {mode === 'edit' && editing && (
          <p className="text-muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
            Slug: <code>{editing.slug}</code> (imutável)
          </p>
        )}

        <label className="field">
          <span>Descrição (opcional)</span>
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Zonas (JSON)</span>
          <textarea
            className="input"
            rows={12}
            value={zonesText}
            onChange={(e) => setZonesText(e.target.value)}
            spellCheck={false}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          />
          {!parsed.ok ? (
            <p className="text-danger" style={{ fontSize: 12, marginTop: 6 }}>
              {parsed.message}
            </p>
          ) : (
            <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              {parsed.zones.length} zona(s) válida(s)
            </p>
          )}
        </label>

        {parsed.ok && (
          <div className="field">
            <span className="field-label">Pré-visualização</span>
            <LayoutTemplateThumb zones={parsed.zones} />
          </div>
        )}

        <label className="field">
          <span>Ordem na galeria</span>
          <input
            type="number"
            className="input"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </label>

        <div className="modal-dialog__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !parsed.ok}>
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
