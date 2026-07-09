'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type ItemRow = {
  id: string;
  position: number;
  durationSec: number | null;
  asset: { id: string; name: string; kind: string; mimeType: string };
};

function SortableRow({
  item,
  index,
  onUpdateDuration,
  onRemove,
}: {
  item: ItemRow;
  index: number;
  onUpdateDuration: (itemId: string, value: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    background: isDragging ? 'var(--color-surface-muted, #f1f5f9)' : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td
        {...attributes}
        {...listeners}
        title="Arrastar para reordenar"
        style={{
          cursor: 'grab',
          width: 40,
          userSelect: 'none',
          color: 'var(--color-text-muted, #64748b)',
          fontSize: 14,
        }}
      >
        ⠿
      </td>
      <td>{index + 1}</td>
      <td>
        <code style={{ fontSize: 12 }}>{item.asset.name}</code>
        <span className="text-muted" style={{ marginLeft: 8 }}>
          {item.asset.mimeType}
        </span>
      </td>
      <td>
        <input
          type="number"
          min={1}
          max={86400}
          className="input"
          style={{ maxWidth: 100 }}
          defaultValue={item.durationSec ?? ''}
          placeholder="—"
          key={`${item.id}-${item.durationSec}`}
          onBlur={(e) => onUpdateDuration(item.id, e.target.value)}
        />
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onRemove(item.id)}
        >
          Remover
        </button>
      </td>
    </tr>
  );
}

type Props = {
  playlistId: string;
  items: ItemRow[];
  onError: (msg: string) => void;
  load: () => Promise<void>;
};

export function PlaylistItemsTable({
  playlistId,
  items: initialItems,
  onError,
  load,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const persistOrder = useCallback(
    async (ordered: ItemRow[]) => {
      setSavingOrder(true);
      onError('');
      try {
        await api(`/playlists/${playlistId}/reorder`, {
          method: 'POST',
          body: JSON.stringify({
            orderedItemIds: ordered.map((it) => it.id),
          }),
        });
        await load();
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Erro ao reordenar');
        await load();
      } finally {
        setSavingOrder(false);
      }
    },
    [playlistId, load, onError]
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    await persistOrder(next);
  }

  async function updateItemDuration(itemId: string, value: string) {
    const trimmed = value.trim();
    const durationSec =
      trimmed === ''
        ? null
        : Math.min(86400, Math.max(1, Math.floor(Number(trimmed))));
    if (trimmed !== '' && (Number.isNaN(durationSec as number) || durationSec === null))
      return;
    onError('');
    try {
      await api(`/playlists/${playlistId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ durationSec }),
      });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function removeItem(itemId: string) {
    if (!confirm('Remover este item da playlist?')) return;
    onError('');
    try {
      await api(`/playlists/${playlistId}/items/${itemId}`, {
        method: 'DELETE',
      });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro');
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-muted">Nenhum item. Adicione pelo menos um asset abaixo.</p>
    );
  }

  return (
    <>
      <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
        Arraste pela primeira coluna para alterar a ordem.
        {savingOrder ? ' A guardar ordem…' : ''}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <div className="surface-table-card" style={{ marginBottom: 'var(--space-6)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} aria-label="Ordenar" />
              <th>#</th>
              <th>Asset</th>
              <th>Duração (s)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((it, idx) => (
                <SortableRow
                  key={it.id}
                  item={it}
                  index={idx}
                  onUpdateDuration={updateItemDuration}
                  onRemove={removeItem}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
        </div>
      </DndContext>
    </>
  );
}
