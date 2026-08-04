import { getApiBase } from './public-urls';

export { getApiBase, getRtUrl } from './public-urls';

function networkFailureMessage(cause: unknown): string {
  const base = getApiBase();
  const intro = `Não foi possível contactar a API em ${base}.`;

  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'https:' && base.startsWith('http:')) {
      return [
        intro,
        '',
        'Conteúdo misto: esta página está em HTTPS e a API está configurada em HTTP. O browser bloqueia o pedido.',
        'Em desenvolvimento, abra o CMS em http://localhost:3000 (ou alinhe protocolo e domínio com a API).',
      ].join('\n');
    }
  }

  const steps = [
    intro,
    '',
    'Verifique por esta ordem:',
    '',
    '1) API Nest na porta 3001 — na raiz: pnpm dev:api  (ou: pnpm turbo run dev --filter=@easysignage/api).',
    '',
    '2) PostgreSQL acessível — em apps/api/.env o DATABASE_URL deve apontar para um servidor em execução. Se a base não estiver disponível, o Nest pode terminar logo à partida e a porta 3001 fica sem serviço (erro parecido a “connection refused”).',
    '',
    '3) URL da API — o CMS usa automaticamente o mesmo host do browser (porta 3001). Confirme CORS_ORIGINS na API.',
    '',
    '4) CORS — só depois da API responder: em apps/api/.env, CORS_ORIGINS deve listar a origem exacta do separador (ex.: http://localhost:3000 e http://127.0.0.1:3000).',
  ];

  const msg = cause instanceof Error ? cause.message.trim() : '';
  if (msg && !/^failed to fetch$/i.test(msg) && !/load failed/i.test(msg)) {
    steps.push('', `Detalhe: ${msg}`);
  }

  return steps.join('\n');
}

/** `fetch` com mensagem útil quando a rede falha (ex.: API parada, CORS, URL errada). */
export async function fetchApi(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    throw new Error(networkFailureMessage(e));
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('access_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem('access_token', token);
  else sessionStorage.removeItem('access_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetchApi(`${getApiBase()}${path}`, { ...options, headers });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(
      `Resposta não JSON da API (HTTP ${res.status}). Confirme a API em ${getApiBase()} (Nest na porta 3001).`
    );
  }

  if (!res.ok) {
    const payload = data as Record<string, unknown> | undefined;
    const raw = payload?.message;
    const msg =
      (Array.isArray(raw) ? raw.join(', ') : raw) ??
      payload?.error ??
      `Erro HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(data));
  }
  return data as T;
}

/** Upload multipart `POST /assets/upload` (campo `file`, opcional `name`). */
export async function uploadAssetMultipart(
  file: File,
  displayName?: string
): Promise<unknown> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  if (displayName?.trim()) {
    form.append('name', displayName.trim());
  }
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetchApi(`${getApiBase()}/assets/upload`, {
    method: 'POST',
    body: form,
    headers,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(
      `Resposta não JSON no upload (HTTP ${res.status}). Confirme a API em ${getApiBase()}.`
    );
  }
  if (!res.ok) {
    const payload = data as Record<string, unknown> | undefined;
    const raw = payload?.message;
    const msg =
      (Array.isArray(raw) ? raw.join(', ') : raw) ??
      payload?.error ??
      `Erro HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(data));
  }
  return data;
}
