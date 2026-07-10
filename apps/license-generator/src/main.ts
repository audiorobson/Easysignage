import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync, readFileSync, cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function resolvePrivateKey(): string {
  const fromEnv = process.env.EASYSIGNAGE_LICENSE_PRIVATE_KEY?.trim();
  if (fromEnv?.includes('BEGIN PRIVATE KEY')) return fromEnv;
  const candidates = [
    join(process.cwd(), 'deploy/keys/dev-private.pem'),
    join(process.cwd(), '../../deploy/keys/dev-private.pem'),
    join(__dirname, '../../../deploy/keys/dev-private.pem'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf8');
    }
  }
  throw new Error(
    'Chave privada não encontrada. Defina EASYSIGNAGE_LICENSE_PRIVATE_KEY ou crie deploy/keys/dev-private.pem (ver deploy/keys/README.md)'
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
    width: 720,
    height: 640,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'EasySignage — Gerador de licenças',
  });
  void win.loadFile(join(__dirname, 'ui', 'index.html'));
}

ipcMain.handle(
  'generate-license',
  async (
    _ev,
    input: {
      hwid: string;
      tier: string;
      customer?: string;
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

    const privateKey = resolvePrivateKey();
    const payload = buildLicensePayload({
      hwid,
      tier: input.tier,
      customer: input.customer,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    const serial = signLicense(payload, privateKey);
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
