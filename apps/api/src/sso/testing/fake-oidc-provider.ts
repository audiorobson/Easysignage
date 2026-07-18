import * as crypto from 'node:crypto';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * IdP OIDC mínimo, em memória, usado apenas em testes de integração do `SsoService`
 * (PR 6.4). Implementa só o necessário para `openid-client` completar um Authorization
 * Code Flow real: discovery, JWKS e o endpoint de token — sem depender de um pacote
 * completo de servidor OIDC (que hoje só publica builds ESM incompatíveis com o `ts-jest`
 * deste projeto).
 */
export class FakeOidcProvider {
  private server: http.Server | null = null;
  private issuerUrl = '';
  private readonly kid = 'test-key-1';
  private readonly keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly codes = new Map<string, { claims: Record<string, unknown>; used: boolean }>();

  clientId = 'test-client-id';
  clientSecret = 'test-client-secret';

  async start(): Promise<string> {
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    this.issuerUrl = `http://127.0.0.1:${port}`;
    return this.issuerUrl;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /** Simula o utilizador a autenticar-se com sucesso no IdP — devolve um `code` de autorização. */
  mintAuthorizationCode(claims: Record<string, unknown>): string {
    const code = crypto.randomBytes(16).toString('hex');
    this.codes.set(code, { claims, used: false });
    return code;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', this.issuerUrl);

    if (url.pathname === '/.well-known/openid-configuration') {
      return this.json(res, 200, {
        issuer: this.issuerUrl,
        authorization_endpoint: `${this.issuerUrl}/auth`,
        token_endpoint: `${this.issuerUrl}/token`,
        jwks_uri: `${this.issuerUrl}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
      });
    }

    if (url.pathname === '/jwks') {
      const jwk = this.keyPair.publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
      return this.json(res, 200, {
        keys: [{ ...jwk, kid: this.kid, use: 'sig', alg: 'RS256' }],
      });
    }

    if (url.pathname === '/token' && req.method === 'POST') {
      return this.handleToken(req, res);
    }

    res.writeHead(404).end('not found');
  }

  private handleToken(req: http.IncomingMessage, res: http.ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = new URLSearchParams(Buffer.concat(chunks).toString('utf-8'));
        const auth = req.headers.authorization ?? '';
        const [, encoded] = auth.split(' ');
        const [clientId, clientSecret] = encoded
          ? Buffer.from(encoded, 'base64').toString('utf-8').split(':')
          : [body.get('client_id'), body.get('client_secret')];

        if (clientId !== this.clientId || clientSecret !== this.clientSecret) {
          return this.json(res, 401, { error: 'invalid_client' });
        }

        const code = body.get('code');
        const entry = code ? this.codes.get(code) : undefined;
        if (!entry || entry.used || body.get('grant_type') !== 'authorization_code') {
          return this.json(res, 400, { error: 'invalid_grant' });
        }
        entry.used = true;

        const now = Math.floor(Date.now() / 1000);
        const idToken = this.signIdToken({
          iss: this.issuerUrl,
          aud: this.clientId,
          iat: now,
          exp: now + 300,
          ...entry.claims,
        });

        return this.json(res, 200, {
          access_token: crypto.randomBytes(16).toString('hex'),
          token_type: 'Bearer',
          expires_in: 300,
          id_token: idToken,
        });
      } catch (err) {
        this.json(res, 500, { error: 'server_error', detail: String(err) });
      }
    });
  }

  private signIdToken(payload: Record<string, unknown>): string {
    const header = { alg: 'RS256', typ: 'JWT', kid: this.kid };
    const encode = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), this.keyPair.privateKey);
    return `${signingInput}.${signature.toString('base64url')}`;
  }

  private json(res: http.ServerResponse, status: number, body: unknown): void {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
}
