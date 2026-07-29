'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import {
  DataTable,
  DataTableBody,
  DataTableCard,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '@/components/ui/DataTable';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

type UserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  totpEnabled: boolean;
  roles: { id: string; name: string }[];
  createdAt: string;
};

type RoleOption = { id: string; name: string };

type QuotaUsage = {
  users: { used: number; max: number };
};

export default function SettingsUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [userRows, roleRows, quotaRow] = await Promise.all([
      api<UserRow[]>('/users'),
      api<RoleOption[]>('/users/roles'),
      api<QuotaUsage>('/settings/quota').catch(() => null),
    ]);
    setUsers(userRows);
    setRoles(roleRows);
    setQuota(quotaRow);
    if (roleRows.length && roleIds.length === 0) {
      setRoleIds([roleRows[0]!.id]);
    }
  }, [roleIds.length]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  function openCreate() {
    setFormError(null);
    setName('');
    setEmail('');
    setPassword('');
    setRoleIds(roles[0] ? [roles[0].id] : []);
    setModalOpen(true);
  }

  function toggleRole(roleId: string) {
    setRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8) {
      setFormError('Preencha nome, e-mail e password (mín. 8 caracteres).');
      return;
    }
    if (!roleIds.length) {
      setFormError('Seleccione pelo menos um papel.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, roleIds }),
      });
      setModalOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao criar utilizador');
    } finally {
      setSaving(false);
    }
  }

  const atQuota =
    quota != null && quota.users.used >= quota.users.max;

  return (
    <>
      <PageHeader
        title="Utilizadores"
        lead="Contas de acesso ao CMS desta organização — sujeitas à quota do plano."
        actions={
          <>
            <Link href="/settings" className="btn btn--ghost">
              Definições
            </Link>
            <button type="button" className="btn btn--ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} aria-hidden />
              Actualizar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreate}
              disabled={atQuota || roles.length === 0}
              title={atQuota ? 'Quota de utilizadores atingida' : undefined}
            >
              <UserPlus size={17} aria-hidden />
              Novo utilizador
            </button>
          </>
        }
      />

      {quota && (
        <p className="text-muted" style={{ marginTop: 0 }}>
          Quota: <strong>{quota.users.used}</strong> / {quota.users.max} utilizadores
        </p>
      )}

      {error && (
        <p className="text-danger" role="alert">
          {error}
        </p>
      )}
      {loading && !users && <p className="text-muted">A carregar…</p>}

      {users && users.length === 0 && (
        <p className="text-muted">
          <Users size={16} style={{ verticalAlign: -3, marginRight: 6 }} aria-hidden />
          Nenhum utilizador além do seed inicial. Crie contas para a equipa.
        </p>
      )}

      {users && users.length > 0 && (
        <DataTableCard ariaLabel="Lista de utilizadores do tenant">
          <DataTable caption="Utilizadores do CMS">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Nome</DataTableHeaderCell>
                <DataTableHeaderCell>E-mail</DataTableHeaderCell>
                <DataTableHeaderCell>Papéis</DataTableHeaderCell>
                <DataTableHeaderCell>2FA</DataTableHeaderCell>
                <DataTableHeaderCell>Criado</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {users.map((u) => (
                <DataTableRow key={u.id}>
                  <DataTableCell className="cell-primary">{u.name}</DataTableCell>
                  <DataTableCell>{u.email}</DataTableCell>
                  <DataTableCell>{u.roles.map((r) => r.name).join(', ') || '—'}</DataTableCell>
                  <DataTableCell>{u.totpEnabled ? 'Activado' : '—'}</DataTableCell>
                  <DataTableCell className="cell-sub">{formatDateTimePtBr(u.createdAt)}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableCard>
      )}

      <Modal
        open={modalOpen}
        title="Novo utilizador"
        titleId="create-user-title"
        onClose={() => setModalOpen(false)}
        maxWidth={480}
      >
        <form onSubmit={(e) => void onSubmit(e)}>
          {formError && (
            <p className="text-danger" role="alert">
              {formError}
            </p>
          )}
          <label className="field">
            <span>Nome</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Password inicial</span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>Papéis</legend>
            {roles.map((r) => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                />
                {r.name}
              </label>
            ))}
          </fieldset>
          <div className="modal-dialog__footer">
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'A criar…' : 'Criar utilizador'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
