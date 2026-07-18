'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
type AuditedMethod = (typeof AUDITED_METHODS)[number];

type AuditLogRow = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  method: string;
  entityType: string;
  entityId: string | null;
  statusCode: number;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const router = useRouter();
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actorEmail, setActorEmail] = useState('');
  const [entityType, setEntityType] = useState('');
  const [method, setMethod] = useState<AuditedMethod | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditLogPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (actorEmail.trim()) p.set('actorEmail', actorEmail.trim());
    if (entityType) p.set('entityType', entityType);
    if (method) p.set('method', method);
    if (from) p.set('from', new Date(from).toISOString());
    if (to) p.set('to', new Date(to).toISOString());
    return p;
  }, [actorEmail, entityType, method, from, to]);

  const load = useCallback(async () => {
    const p = new URLSearchParams(query);
    p.set('page', String(page));
    p.set('pageSize', String(PAGE_SIZE));
    const data = await api<AuditLogPage>(`/audit-logs?${p.toString()}`);
    setResult(data);
  }, [query, page]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const types = await api<string[]>('/audit-logs/entity-types');
        if (!cancelled) setEntityTypes(types);
      } catch {
        if (!cancelled) setEntityTypes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
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
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [actorEmail, entityType, method, from, to]);

  const rows = result?.rows ?? null;
  const total = result?.total ?? 0;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Auditoria"
        lead="Trilha de auditoria: todas as alterações (criar/editar/remover) feitas por utilizadores do CMS, com quem, quando e o resultado."
        actions={
          <Link href="/settings" className="btn btn--ghost">
            <ArrowLeft size={16} aria-hidden />
            Voltar a Configurações
          </Link>
        }
      />

      <div className="surface-filters">
        <input
          type="text"
          className="select"
          placeholder="Filtrar por e-mail do utilizador"
          value={actorEmail}
          onChange={(e) => setActorEmail(e.target.value)}
          aria-label="E-mail do utilizador"
        />
        <select
          className="select"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          aria-label="Área"
        >
          <option value="">Todas as áreas</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={method}
          onChange={(e) => setMethod(e.target.value as AuditedMethod | '')}
          aria-label="Ação"
        >
          <option value="">Todas as ações</option>
          <option value="POST">Criar</option>
          <option value="PATCH">Editar</option>
          <option value="PUT">Editar</option>
          <option value="DELETE">Remover</option>
        </select>
        <input
          type="datetime-local"
          className="select"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="A partir de"
        />
        <input
          type="datetime-local"
          className="select"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Até"
        />
      </div>

      {error && <p className="text-danger">{error}</p>}
      {rows === null && !error && <p className="text-muted">A carregar…</p>}
      {rows && rows.length === 0 && (
        <EmptyState
          title="Sem registos de auditoria"
          description="Nenhuma alteração encontrada para os filtros selecionados."
        />
      )}

      {rows && rows.length > 0 && (
        <div className="surface-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Utilizador</th>
                <th>Ação</th>
                <th>Área</th>
                <th>Item</th>
                <th>Resultado</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-sub">{formatDateTimePtBr(r.createdAt)}</td>
                  <td>{r.actorEmail ?? '—'}</td>
                  <td>
                    <span className="badge badge--neutral">{methodLabelPt(r.method)}</span>
                  </td>
                  <td>{r.entityType}</td>
                  <td className="cell-sub">{r.entityId ?? '—'}</td>
                  <td>
                    <span className={`badge ${r.success ? 'badge--success' : 'badge--danger'}`}>
                      <ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden />
                      {r.statusCode}
                    </span>
                  </td>
                  <td className="cell-sub">{r.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="table-footer">
          <span>
            A mostrar {rows.length} de {total} registos — página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Seguinte
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function methodLabelPt(method: string): string {
  switch (method) {
    case 'POST':
      return 'Criar';
    case 'PATCH':
    case 'PUT':
      return 'Editar';
    case 'DELETE':
      return 'Remover';
    default:
      return method;
  }
}
