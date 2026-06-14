import { Injectable, Logger } from '@nestjs/common';
import { SerproClient } from './serpro.client';

const ID_SISTEMA = 'PGMEI';
const SERV_GERAR_DAS_PDF = 'GERARDASPDF21'; // retorna PDF + detalhamento (valores, vencimento)

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

    // GERARDASPDF21 já retorna o PDF E o detalhamento (valores, vencimento).
    const resp = await this.serpro.chamar(
      tenantId,
      'Emitir',
      cnpj,
      ID_SISTEMA,
      SERV_GERAR_DAS_PDF,
      dados,
    );
    return this.parse(competencia, resp);
  }

  // A resposta traz `dados` como string JSON, com o detalhamento aninhado
  // (ex.: dados[0] = { valores, dataVencimento, pdf, ... }). Buscamos de forma
  // robusta o nó com `valores` e o campo `pdf` em qualquer profundidade.
  private parse(competencia: string, resp: any): DasMei {
    let dados: any = resp?.dados;
    if (typeof dados === 'string') {
      try {
        dados = JSON.parse(dados);
      } catch {
        /* mantém string */
      }
    }

    const det = deepFind(
      dados,
      (n) => !!n && typeof n === 'object' && !!(n as any).valores,
    ) as any;
    const pdf = deepFindString(dados, 'pdf');

    const valor =
      det?.valores?.total ??
      det?.valorTotalDoDocumento ??
      det?.valorTotal ??
      undefined;
    const vencRaw =
      det?.dataVencimento ?? det?.dataDeVencimento ?? det?.dataLimiteAcolhimento;

    return {
      competencia,
      valorTotal: valor != null ? Number(valor) : undefined,
      vencimento: normalizarData(vencRaw),
      linhaDigitavel:
        det?.linhaDigitavel ?? det?.codigoDeBarras ?? det?.numeroDocumento ?? undefined,
      pdfBase64: pdf,
      raw: resp,
    };
  }
}

// Busca em profundidade o primeiro nó que satisfaz o predicado.
function deepFind(obj: any, pred: (n: unknown) => boolean): unknown {
  if (pred(obj)) return obj;
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const r = deepFind(v, pred);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

// Busca em profundidade o primeiro valor string de uma chave (ex.: 'pdf').
function deepFindString(obj: any, key: string): string | undefined {
  if (obj && typeof obj === 'object') {
    if (typeof obj[key] === 'string' && obj[key].length > 50) return obj[key];
    for (const v of Object.values(obj)) {
      const r = deepFindString(v, key);
      if (r !== undefined) return r;
    }
  }
  return undefined;
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
