import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Cliente HTTP da API Omie (https://app.omie.com.br/api/v1/).
// Toda chamada é um POST com { call, app_key, app_secret, param: [ ... ] }.
export class OmieApiError extends Error {
  constructor(
    message: string,
    public readonly faultcode?: string,
  ) {
    super(message);
  }
}

@Injectable()
export class OmieClient {
  private readonly logger = new Logger('OmieClient');
  private readonly base = 'https://app.omie.com.br/api/v1';
  private readonly appKey: string;
  private readonly appSecret: string;

  constructor(config: ConfigService) {
    this.appKey = config.get<string>('OMIE_APP_KEY') ?? '';
    this.appSecret = config.get<string>('OMIE_APP_SECRET') ?? '';
  }

  get configurado(): boolean {
    return !!this.appKey && !!this.appSecret;
  }

  // endpoint ex.: "geral/clientes" | "servicos/os"
  async call<T = any>(
    endpoint: string,
    callName: string,
    param: Record<string, unknown>,
  ): Promise<T> {
    if (!this.configurado) {
      throw new OmieApiError('OMIE_APP_KEY/OMIE_APP_SECRET não configurados');
    }
    const body = {
      call: callName,
      app_key: this.appKey,
      app_secret: this.appSecret,
      param: [param],
    };

    const res = await fetch(`${this.base}/${endpoint}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json: any = await res.json().catch(() => ({}));

    // A Omie retorna 200 mesmo em erro de negócio, sinalizando via faultstring.
    if (json?.faultstring) {
      throw new OmieApiError(json.faultstring, json.faultcode);
    }
    if (json?.status === 'error') {
      throw new OmieApiError(json.message ?? 'Erro Omie');
    }
    if (!res.ok) {
      throw new OmieApiError(`HTTP ${res.status} na chamada ${callName}`);
    }
    return json as T;
  }
}
