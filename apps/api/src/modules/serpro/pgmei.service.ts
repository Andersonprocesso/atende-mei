import { Injectable, Logger } from '@nestjs/common';
import { SerproClient } from './serpro.client';

const ID_SISTEMA = 'PGMEI';
const SERV_GERAR_DAS = 'GERARDASPDF21';

export interface DasMei {
  competencia: string; // 'AAAA-MM'
  valorTotal?: number;
  vencimento?: string; // ISO
  linhaDigitavel?: string;
  pdfBase64?: string;
  raw: unknown;
}

// PGMEI — geração da guia DAS do MEI (Integra Contador / SERPRO).
// Gerar a DAS é idempotente e não é emissão fiscal irreversível: é a guia
// de pagamento da competência, pode ser gerada quantas vezes precisar.
@Injectable()
export class PgmeiService {
  private readonly logger = new Logger('PGMEI');

  constructor(private readonly serpro: SerproClient) {}

  configurado(tenantId: string) {
    return this.serpro.configurado(tenantId);
  }

  async gerarDas(tenantId: string, cnpj: string, competencia: string): Promise<DasMei> {
    const pa = competencia.replace('-', ''); // AAAAMM
    const dados = JSON.stringify({ periodoApuracao: pa });

    const resp = await this.serpro.chamar(
      tenantId,
      'Emitir',
      cnpj,
      ID_SISTEMA,
      SERV_GERAR_DAS,
      dados,
    );

    return this.parse(competencia, resp);
  }

  // A resposta traz `dados` como string JSON; extraímos PDF + detalhes de
  // forma defensiva (o shape exato varia conforme a versão do serviço).
  private parse(competencia: string, resp: any): DasMei {
    let dados: any = resp?.dados;
    if (typeof dados === 'string') {
      try {
        dados = JSON.parse(dados);
      } catch {
        /* mantém string */
      }
    }

    const doc =
      dados?.documentos?.[0] ??
      (Array.isArray(dados) ? dados[0] : undefined) ??
      dados ??
      {};

    const det = doc?.detalhamento ?? doc;

    const valor =
      det?.valores?.total ??
      det?.valorTotalDoDocumento ??
      det?.valorTotal ??
      undefined;

    return {
      competencia,
      valorTotal: valor != null ? Number(valor) : undefined,
      vencimento: det?.dataVencimento ?? det?.dataDeVencimento ?? undefined,
      linhaDigitavel:
        det?.linhaDigitavel ?? det?.codigoDeBarras ?? det?.codigoBarras ?? undefined,
      pdfBase64: doc?.pdf ?? dados?.pdf ?? undefined,
      raw: resp,
    };
  }
}
