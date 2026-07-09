'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
};

export function GroupsListClient() {
  const router = useRouter();
  const [items, setItems] = useState<GroupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api<GroupRow[]>('/groups');
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Grupos de dispositivos</h1>
          <p className="page-header__lead">
            Agrupe dispositivos para teste de conteúdo ou publicação em conjunto.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/groups/new" className="btn btn--gradient">
            <i className="fa-solid fa-plus" aria-hidden />
            Novo grupo
          </Link>
        </div>
      </header>

      <section>
        {error && <p className="text-danger">{error}</p>}
        {!items && !error && <p className="text-muted">Carregando…</p>}
        {items && items.length === 0 && (
          <p className="text-muted">Nenhum grupo. Crie um e adicione dispositivos cadastrados.</p>
        )}
        {items && items.length > 0 && (
          <div className="surface-table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Dispositivos</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/groups/${g.id}`}>{g.name}</Link>
                      {g.description ? (
                        <div
                          className="text-muted"
                          style={{ fontSize: 13, marginTop: 4 }}
                        >
                          {g.description.length > 80
                            ? `${g.description.slice(0, 77)}…`
                            : g.description}
                        </div>
                      ) : null}
                    </td>
                    <td>{g.deviceCount}</td>
                    <td>{formatDateTimePtBr(g.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
