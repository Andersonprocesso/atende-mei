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
  private readonly contratante: string;
  private readonly autor: string;

  constructor(
    private readonly auth: SerproAuthService,
    config: ConfigService,
  ) {
    this.baseUrl =
      config.get<string>('SERPRO_BASE_URL') ??
      'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1';
    this.contratante = (config.get<string>('SERPRO_CONTRATANTE_CNPJ') ?? '').replace(/\D/g, '');
    this.autor =
      (config.get<string>('SERPRO_AUTOR_CNPJ') ?? this.contratante).replace(/\D/g, '') ||
      this.contratante;
  }

  get configurado(): boolean {
    return this.auth.configurado && !!this.contratante;
  }

  private envelope(
    contribuinte: string,
    idSistema: string,
    idServico: string,
    versao: string,
    dados: string,
  ) {
    const tipo = contribuinte.length === 14 ? 2 : 1;
    return {
      contratante: { numero: this.contratante, tipo: 2 },
      autorPedidoDados: { numero: this.autor, tipo: 2 },
      contribuinte: { numero: contribuinte, tipo },
      pedidoDados: {
        idSistema,
        idServico,
        versaoSistema: versao,
        dados,
      },
    };
  }

  async chamar(
    operacao: 'Consultar' | 'Emitir' | 'Declarar' | 'Apoiar' | 'Monitorar',
    contribuinte: string,
    idSistema: string,
    idServico: string,
    dados: string,
    versao = '1.0',
  ): Promise<any> {
    const cnpj = contribuinte.replace(/\D/g, '');
    const tokens = await this.auth.obterTokens();

    const resp = await fetch(`${this.baseUrl}/${operacao}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.access_token}`,
        ...(tokens.jwt_token ? { jwt_token: tokens.jwt_token } : {}),
      },
      body: JSON.stringify(
        this.envelope(cnpj, idSistema, idServico, versao, dados),
      ),
    });

    const texto = await resp.text();
    if (resp.status === 429) {
      throw new SerproError('SERPRO: limite de requisições (429), tente em instantes');
    }
    if (resp.status >= 400) {
      throw new SerproError(
        `${idSistema}/${idServico} HTTP ${resp.status}: ${texto.slice(0, 400)}`,
      );
    }
    try {
      return JSON.parse(texto);
    } catch {
      return { raw: texto };
    }
  }
}
