import { Injectable, Logger } from '@nestjs/common';
import { SerproClient } from './serpro.client';

const ID_SISTEMA = 'PGMEI';
const SERV_GERAR_DAS_PDF = 'GERARDASPDF21'; // retorna o PDF (base64)
const SERV_GERAR_DAS_CODBARRA = 'GERARDASCODBARRA21'; // retorna detalhamento (valor, venc, linha)

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

    // PDF da guia
    const respPdf = await this.serpro.chamar(
      tenantId,
      'Emitir',
      cnpj,
      ID_SISTEMA,
      SERV_GERAR_DAS_PDF,
      dados,
    );
    const base = this.parse(competencia, respPdf);

    // detalhamento (valor, vencimento, linha digitável) — best-effort
    try {
      const respDet = await this.serpro.chamar(
        tenantId,
        'Emitir',
        cnpj,
        ID_SISTEMA,
        SERV_GERAR_DAS_CODBARRA,
        dados,
      );
      const det = this.parse(competencia, respDet);
      base.valorTotal = base.valorTotal ?? det.valorTotal;
      base.vencimento = base.vencimento ?? det.vencimento;
      base.linhaDigitavel = base.linhaDigitavel ?? det.linhaDigitavel;
    } catch (e) {
      this.logger.warn(`Detalhamento da DAS indisponível: ${e}`);
    }

    return base;
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

    // DEBUG temporário: estrutura da resposta (sem o PDF) para acertar o parser
    try {
      const semPdf = (o: any) => {
        const c = JSON.parse(JSON.stringify(o ?? {}));
        if (c?.pdf) c.pdf = `<${String(c.pdf).length} bytes>`;
        return c;
      };
      this.logger.log(
        `DEBUG dados-keys=${JSON.stringify(Object.keys(dados ?? {}))} det=${JSON.stringify(semPdf(det)).slice(0, 800)}`,
      );
    } catch {
      /* ignore */
    }

    const valor =
      det?.valores?.total ??
      det?.valorTotalDoDocumento ??
      det?.valorTotal ??
      undefined;

    const vencRaw = det?.dataVencimento ?? det?.dataDeVencimento ?? det?.dataLimiteAcolhimento;

    return {
      competencia,
      valorTotal: valor != null ? Number(valor) : undefined,
      vencimento: normalizarData(vencRaw),
      linhaDigitavel:
        det?.linhaDigitavel ?? det?.codigoDeBarras ?? det?.codigoBarras ?? undefined,
      pdfBase64: doc?.pdf ?? dados?.pdf ?? undefined,
      raw: resp,
    };
  }
}

// Aceita 'AAAA-MM-DD', 'AAAAMMDD', 'DDMMAAAA' e devolve ISO (YYYY-MM-DD) ou undefined.
function normalizarData(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = s.replace(/\D/g, '');
  if (d.length === 8) {
    // AAAAMMDD vs DDMMAAAA
    if (Number(d.slice(0, 4)) > 1900) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
  }
  return undefined;
}
