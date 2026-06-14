import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as fs from 'fs';
import { CredenciaisSerproService } from './credenciais-serpro.service';

export class SerproAuthError extends Error {}

interface Tokens {
  access_token: string;
  jwt_token?: string;
}

interface CredsResolvidas {
  consumerKey: string;
  consumerSecret: string;
  pfx: Buffer;
  senha: string;
  contratanteCnpj?: string;
  autorCnpj?: string;
}

// Autenticação no Integra Contador (SERPRO), por tenant.
// As credenciais vêm do banco (subidas pelo painel, cifradas) e, na ausência,
// caem para variáveis de ambiente. Fluxo: POST {AUTH_URL} com Basic Auth +
// Role-Type: TERCEIROS + grant_type=client_credentials + mTLS (e-CNPJ).
@Injectable()
export class SerproAuthService {
  private readonly logger = new Logger('SerproAuth');
  private readonly authUrl: string;
  private readonly cache = new Map<string, { tokens: Tokens; expiraEm: number }>();

  constructor(
    private readonly config: ConfigService,
    private readonly credenciais: CredenciaisSerproService,
  ) {
    this.authUrl =
      config.get<string>('SERPRO_AUTH_URL') ??
      'https://autenticacao.sapi.serpro.gov.br/authenticate';
  }

  // Resolve credenciais: banco (cifrado) tem prioridade; senão, env.
  async resolver(tenantId: string): Promise<CredsResolvidas | null> {
    const db = await this.credenciais.carregar(tenantId);
    if (db?.consumerKey && db?.consumerSecret && db?.pfx) {
      return {
        consumerKey: db.consumerKey,
        consumerSecret: db.consumerSecret,
        pfx: db.pfx,
        senha: db.senhaPfx ?? '',
        contratanteCnpj: db.contratanteCnpj,
        autorCnpj: db.autorCnpj,
      };
    }

    // fallback env
    const key = this.config.get<string>('SERPRO_CONSUMER_KEY');
    const secret = this.config.get<string>('SERPRO_CONSUMER_SECRET');
    const pfx = this.pfxFromEnv();
    if (key && secret && pfx) {
      return {
        consumerKey: key,
        consumerSecret: secret,
        pfx,
        senha: this.config.get<string>('SERPRO_CERT_SENHA') ?? '',
        contratanteCnpj: this.config.get<string>('SERPRO_CONTRATANTE_CNPJ'),
        autorCnpj: this.config.get<string>('SERPRO_AUTOR_CNPJ'),
      };
    }
    return null;
  }

  async configurado(tenantId: string): Promise<boolean> {
    return (await this.resolver(tenantId)) !== null;
  }

  async obterTokens(tenantId: string): Promise<Tokens> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiraEm > Date.now()) return cached.tokens;

    const creds = await this.resolver(tenantId);
    if (!creds) throw new SerproAuthError('SERPRO não configurado para este tenant.');

    const basic = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64');
    const resp = await this.postMtls(
      this.authUrl,
      'grant_type=client_credentials',
      {
        Authorization: `Basic ${basic}`,
        'Role-Type': 'TERCEIROS',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      creds.pfx,
      creds.senha,
    );

    if (resp.status !== 200) {
      throw new SerproAuthError(`HTTP ${resp.status}: ${resp.body.slice(0, 300)}`);
    }
    const json = JSON.parse(resp.body);
    if (!json.access_token) throw new SerproAuthError('Resposta sem access_token');

    const tokens: Tokens = { access_token: json.access_token, jwt_token: json.jwt_token };
    const ttl = Math.max((Number(json.expires_in) || 3600) - 60, 60);
    this.cache.set(tenantId, { tokens, expiraEm: Date.now() + ttl * 1000 });
    return tokens;
  }

  private pfxFromEnv(): Buffer | undefined {
    const b64 = this.config.get<string>('SERPRO_CERT_PFX_BASE64');
    const path = this.config.get<string>('SERPRO_CERT_PFX_PATH');
    try {
      if (b64) return Buffer.from(b64, 'base64');
      if (path && fs.existsSync(path)) return fs.readFileSync(path);
    } catch (e) {
      this.logger.error(`Falha ao ler .pfx do env: ${e}`);
    }
    return undefined;
  }

  private postMtls(
    url: string,
    body: string,
    headers: Record<string, string>,
    pfx: Buffer,
    senha: string,
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = https.request(
        {
          method: 'POST',
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
          pfx,
          passphrase: senha,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
