import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { appendFileSync, existsSync, mkdirSync, readFileSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type KeySource = 'env' | 'session-file' | 'production-file' | 'staging-file' | 'dev-file' | 'none';

let sessionPrivateKey: string | null = null;
let sessionKeyLabel: string | null = null;

function licenseEnv(): 'production' | 'staging' | 'development' {
  if (process.env.EASYSIGNAGE_LICENSE_ENV === 'production') return 'production';
  if (process.env.EASYSIGNAGE_LICENSE_ENV === 'staging') return 'staging';
  return 'development';
}

function readPem(path: string): string {
  const pem = readFileSync(path, 'utf8').trim();
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    throw new Error(`Ficheiro inválido (esperado PEM PKCS#8): ${path}`);
  }
  return pem;
}

function resolvePrivateKey(): { pem: string; source: KeySource; label: string } {
  const fromEnv = process.env.EASYSIGNAGE_LICENSE_PRIVATE_KEY?.trim();
  if (fromEnv?.includes('BEGIN PRIVATE KEY')) {
    return { pem: fromEnv, source: 'env', label: 'Variável EASYSIGNAGE_LICENSE_PRIVATE_KEY' };
  }

  if (sessionPrivateKey) {
    return {
      pem: sessionPrivateKey,
      source: 'session-file',
      label: sessionKeyLabel ?? 'Ficheiro carregado nesta sessão',
    };
  }

  const env = licenseEnv();
  const isProd = process.env.NODE_ENV === 'production' || env === 'production';

  const candidates: Array<{ paths: string[]; source: KeySource; label: string; allowInProd: boolean }> = [
    {
      paths: [
        join(process.cwd(), 'deploy/keys/production-private.pem'),
        join(process.cwd(), '../../deploy/keys/production-private.pem'),
        join(__dirname, '../../../deploy/keys/production-private.pem'),
      ],
      source: 'production-file',
      label: 'deploy/keys/production-private.pem',
      allowInProd: true,
    },
    {
      paths: [
        join(process.cwd(), 'deploy/keys/staging-private.pem'),
        join(process.cwd(), '../../deploy/keys/staging-private.pem'),
        join(__dirname, '../../../deploy/keys/staging-private.pem'),
      ],
      source: 'staging-file',
      label: 'deploy/keys/staging-private.pem',
      allowInProd: env === 'staging',
    },
    {
      paths: [
        join(process.cwd(), 'deploy/keys/dev-private.pem'),
        join(process.cwd(), '../../deploy/keys/dev-private.pem'),
        join(__dirname, '../../../deploy/keys/dev-private.pem'),
      ],
      source: 'dev-file',
      label: 'deploy/keys/dev-private.pem',
      allowInProd: false,
    },
  ];

  const search =
    env === 'production'
      ? candidates.filter((c) => c.source === 'production-file')
      : env === 'staging'
        ? candidates.filter((c) => c.source !== 'dev-file')
        : candidates;

  for (const entry of search) {
    for (const p of entry.paths) {
      if (!existsSync(p)) continue;
      if (isProd && !entry.allowInProd) {
        throw new Error(
          `Chave de ${entry.label} detectada em produção — use chave comercial (cofre) ou EASYSIGNAGE_LICENSE_PRIVATE_KEY`
        );
      }
      return { pem: readPem(p), source: entry.source, label: entry.label };
    }
  }

  throw new Error(
    'Chave privada não encontrada. Defina EASYSIGNAGE_LICENSE_PRIVATE_KEY, carregue um PEM na UI, ou consulte docs/cofre-chave-licenca-producao.md'
  );
}

function issuanceLogPath(): string {
  const base =
    process.env.EASYSIGNAGE_LICENSE_LOG_DIR?.trim() ||
    join(homedir(), 'EasySignage', 'license-generator');
  mkdirSync(base, { recursive: true });
  return join(base, 'issuance-log.jsonl');
}

function appendIssuance(entry: Record<string, unknown>) {
  appendFileSync(
    issuanceLogPath(),
    JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n',
    'utf8'
  );
}

function ensureUiCopied() {
  const src = join(__dirname, '..', 'src', 'ui');
  const dest = join(__dirname, 'ui');
  if (existsSync(src) && !existsSync(join(dest, 'index.html'))) {
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
  }
}

function createWindow() {
  ensureUiCopied();
  const win = new BrowserWindow({
    width: 780,
    height: 720,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'EasySignage — Gerador de licenças',
  });
  void win.loadFile(join(__dirname, 'ui', 'index.html'));
}

ipcMain.handle('get-key-status', async () => {
  try {
    const { source, label } = resolvePrivateKey();
    return {
      ok: true,
      env: licenseEnv(),
      source,
      label,
      logPath: issuanceLogPath(),
    };
  } catch (e) {
    return {
      ok: false,
      env: licenseEnv(),
      source: 'none' as KeySource,
      label: null,
      error: e instanceof Error ? e.message : String(e),
      logPath: issuanceLogPath(),
    };
  }
});

ipcMain.handle('load-private-key-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Carregar chave privada Ed25519 (PEM)',
    properties: ['openFile'],
    filters: [{ name: 'PEM', extensions: ['pem', 'key'] }],
  });
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, cancelled: true };
  }
  const path = result.filePaths[0];
  sessionPrivateKey = readPem(path);
  sessionKeyLabel = path;
  return { ok: true, label: path };
});

ipcMain.handle('clear-session-key', async () => {
  sessionPrivateKey = null;
  sessionKeyLabel = null;
  return { ok: true };
});

ipcMain.handle(
  'generate-license',
  async (
    _ev,
    input: {
      hwid: string;
      tier: string;
      customer?: string;
      notes?: string;
      expiresAt?: string | null;
    }
  ) => {
    const {
      buildLicensePayload,
      formatSerialForDisplay,
      isValidHardwareId,
      signLicense,
      tierLabelPt,
      isLicenseTier,
    } = await import('@easysignage/license-core');

    const hwid = input.hwid.trim().toUpperCase();
    if (!isValidHardwareId(hwid)) {
      throw new Error('Hardware ID inválido (formato ES-…)');
    }
    if (!isLicenseTier(input.tier) || input.tier === 'TRIAL') {
      throw new Error('Selecione Lite, Standard ou Elite');
    }

    const { pem, source, label } = resolvePrivateKey();
    const payload = buildLicensePayload({
      hwid,
      tier: input.tier,
      customer: input.customer,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    const serial = signLicense(payload, pem);

    appendIssuance({
      hwid,
      tier: input.tier,
      customer: input.customer?.trim() || null,
      notes: input.notes?.trim() || null,
      expiresAt: input.expiresAt ?? null,
      keySource: source,
      keyLabel: label,
    });

    return {
      serial,
      display: formatSerialForDisplay(serial),
      tierLabel: tierLabelPt(payload.tier),
      maxPlayers: payload.maxPlayers,
    };
  }
);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
