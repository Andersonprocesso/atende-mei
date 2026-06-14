import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as fs from 'fs';

export class SerproAuthError extends Error {}

interface Tokens {
  access_token: string;
  jwt_token?: string;
}

// Autenticação no Integra Contador (SERPRO).
// Fluxo: POST {AUTH_URL} com Basic Auth (consumer key:secret), header
// Role-Type: TERCEIROS, grant_type=client_credentials e mTLS com o e-CNPJ
// (certificado A1 da Dias de Paula). Devolve access_token + jwt_token,
// ambos necessários nas chamadas. Cache em memória até expirar.
@Injectable()
export class SerproAuthService {
  private readonly logger = new Logger('SerproAuth');
  private readonly authUrl: string;
  private readonly key: string;
  private readonly secret: string;
  private readonly pfx?: Buffer;
  private readonly senha: string;

  private cache?: { tokens: Tokens; expiraEm: number };

  constructor(config: ConfigService) {
    this.authUrl =
      config.get<string>('SERPRO_AUTH_URL') ??
      'https://autenticacao.sapi.serpro.gov.br/authenticate';
    this.key = config.get<string>('SERPRO_CONSUMER_KEY') ?? '';
    this.secret = config.get<string>('SERPRO_CONSUMER_SECRET') ?? '';
    this.senha = config.get<string>('SERPRO_CERT_SENHA') ?? '';

    const b64 = config.get<string>('SERPRO_CERT_PFX_BASE64');
    const path = config.get<string>('SERPRO_CERT_PFX_PATH');
    try {
      if (b64) this.pfx = Buffer.from(b64, 'base64');
      else if (path && fs.existsSync(path)) this.pfx = fs.readFileSync(path);
    } catch (e) {
      this.logger.error(`Falha ao carregar o certificado .pfx: ${e}`);
    }
  }

  get configurado(): boolean {
    return !!this.key && !!this.secret && !!this.pfx;
  }

  async obterTokens(): Promise<Tokens> {
    if (this.cache && this.cache.expiraEm > Date.now()) {
      return this.cache.tokens;
    }
    if (!this.configurado) {
      throw new SerproAuthError(
        'SERPRO não configurado (consumer key/secret e certificado .pfx).',
      );
    }

    const basic = Buffer.from(`${this.key}:${this.secret}`).toString('base64');
    const body = 'grant_type=client_credentials';

    const resp = await this.postMtls(this.authUrl, body, {
      Authorization: `Basic ${basic}`,
      'Role-Type': 'TERCEIROS',
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    if (resp.status !== 200) {
      throw new SerproAuthError(`HTTP ${resp.status}: ${resp.body.slice(0, 300)}`);
    }
    const json = JSON.parse(resp.body);
    if (!json.access_token) {
      throw new SerproAuthError(`Resposta sem access_token`);
    }
    const tokens: Tokens = {
      access_token: json.access_token,
      jwt_token: json.jwt_token,
    };
    const ttl = Math.max((Number(json.expires_in) || 3600) - 60, 60);
    this.cache = { tokens, expiraEm: Date.now() + ttl * 1000 };
    return tokens;
  }

  // POST com mTLS (certificado cliente .pfx). Usa node:https pois o fetch
  // global não expõe client cert de forma simples.
  private postMtls(
    url: string,
    body: string,
    headers: Record<string, string>,
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
          pfx: this.pfx,
          passphrase: this.senha,
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
