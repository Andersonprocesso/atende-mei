import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SerproAuthService } from './serpro-auth.service';

export class SerproError extends Error {}

// Cliente do Integra Contador: monta o envelope padrão e executa a operação.
// Operações: Consultar | Emitir | Declarar | Apoiar | Monitorar.
// Para a Dias de Paula, contratante == autorPedidoDados (ela detém o contrato
// E é a procuradora dos MEIs); a procuração MEI→Dias é validada pelo gateway.
@Injectable()
export class SerproClient {
  private readonly baseUrl: string;
  private readonly contratanteDefault: string;
  private readonly autorDefault: string;

  constructor(
    private readonly auth: SerproAuthService,
    config: ConfigService,
  ) {
    this.baseUrl =
      config.get<string>('SERPRO_BASE_URL') ??
      'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1';
    this.contratanteDefault = (
      config.get<string>('SERPRO_CONTRATANTE_CNPJ') ?? ''
    ).replace(/\D/g, '');
    this.autorDefault = (
      config.get<string>('SERPRO_AUTOR_CNPJ') ?? this.contratanteDefault
    ).replace(/\D/g, '');
  }

  configurado(tenantId: string): Promise<boolean> {
    return this.auth.configurado(tenantId);
  }

  async chamar(
    tenantId: string,
    operacao: 'Consultar' | 'Emitir' | 'Declarar' | 'Apoiar' | 'Monitorar',
    contribuinte: string,
    idSistema: string,
    idServico: string,
    dados: string,
    versao = '1.0',
  ): Promise<any> {
    const cnpj = contribuinte.replace(/\D/g, '');
    const creds = await this.auth.resolver(tenantId);
    const contratante = (creds?.contratanteCnpj || this.contratanteDefault).replace(/\D/g, '');
    const autor = (creds?.autorCnpj || contratante).replace(/\D/g, '');
    const tokens = await this.auth.obterTokens(tenantId);

    const tipo = cnpj.length === 14 ? 2 : 1;
    const envelope = {
      contratante: { numero: contratante, tipo: 2 },
      autorPedidoDados: { numero: autor, tipo: 2 },
      contribuinte: { numero: cnpj, tipo },
      pedidoDados: { idSistema, idServico, versaoSistema: versao, dados },
    };

    const resp = await fetch(`${this.baseUrl}/${operacao}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.access_token}`,
        ...(tokens.jwt_token ? { jwt_token: tokens.jwt_token } : {}),
      },
      body: JSON.stringify(envelope),
    });

    const texto = await resp.text();
    if (resp.status === 429) {
      throw new SerproError('SERPRO: limite de requisições (429), tente em instantes');
    }
    if (resp.status >= 400) {
      throw new SerproError(
        `${idSistema}/${idServico} HTTP ${resp.status}: ${texto.slice(0, 1500)}`,
      );
    }
    try {
      return JSON.parse(texto);
    } catch {
      return { raw: texto };
    }
  }
}
