import * as https from 'https';
import * as zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';

// Cliente do webservice nacional NFeDistribuicaoDFe (SEFAZ / Ambiente Nacional).
// Baixa, com o certificado A1 da própria empresa (mTLS), os DF-e destinados ao
// seu CNPJ (NF-e de ENTRADA). Cursor por distNSU/ultNSU. Espelha o Radar.

const URL_PRODUCAO =
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_HOMOLOGACAO =
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';
const SOAP_ACTION =
  'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';

const UF_CODIGO: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

export class SefazError extends Error {}

export interface DocumentoDistribuido {
  nsu: string;
  schema: string;
  xml: string;
}

export interface RespostaDistribuicao {
  cstat: string;
  motivo: string;
  ultimoNsu: string;
  maxNsu: string;
  documentos: DocumentoDistribuido[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
});

function montarEnvelope(documento: string, cuf: string, ambiente: number, ultNsu: string): string {
  const nsu = ultNsu.padStart(15, '0');
  const tag = documento.length === 11 ? 'CPF' : 'CNPJ';
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap12:Body>' +
    '<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">' +
    '<nfeDadosMsg>' +
    `<distDFeInt versao="1.01" xmlns="${NS_NFE}">` +
    `<tpAmb>${ambiente}</tpAmb><cUFAutor>${cuf}</cUFAutor>` +
    `<${tag}>${documento}</${tag}>` +
    `<distNSU><ultNSU>${nsu}</ultNSU></distNSU>` +
    '</distDFeInt>' +
    '</nfeDadosMsg></nfeDistDFeInteresse>' +
    '</soap12:Body></soap12:Envelope>'
  );
}

function parseResposta(corpo: string): RespostaDistribuicao {
  const obj = parser.parse(corpo);
  const ret = acharProp(obj, 'retDistDFeInt');
  if (!ret) {
    throw new SefazError(`Resposta inesperada da SEFAZ: ${corpo.slice(0, 300)}`);
  }
  const resp: RespostaDistribuicao = {
    cstat: String(ret.cStat ?? ''),
    motivo: String(ret.xMotivo ?? ''),
    ultimoNsu: String(ret.ultNSU ?? '0'),
    maxNsu: String(ret.maxNSU ?? '0'),
    documentos: [],
  };
  const lote = ret.loteDistDFeInt;
  if (lote?.docZip) {
    const docs = Array.isArray(lote.docZip) ? lote.docZip : [lote.docZip];
    for (const d of docs) {
      const b64 = d['#text'] ?? '';
      if (!b64) continue;
      try {
        const xml = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf-8');
        resp.documentos.push({
          nsu: String(d['@_NSU'] ?? ''),
          schema: String(d['@_schema'] ?? ''),
          xml,
        });
      } catch {
        /* doc inválido — ignora */
      }
    }
  }
  return resp;
}

// busca recursiva por uma propriedade (ignora namespaces já removidos)
function acharProp(obj: any, nome: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (nome in obj) return obj[nome];
  for (const v of Object.values(obj)) {
    const r = acharProp(v, nome);
    if (r !== undefined) return r;
  }
  return undefined;
}

export function fimDaFila(r: RespostaDistribuicao): boolean {
  const u = parseInt(r.ultimoNsu, 10);
  const m = parseInt(r.maxNsu, 10);
  return !Number.isFinite(u) || !Number.isFinite(m) || u >= m;
}

export async function consultarDistribuicao(params: {
  cnpj: string;
  uf: string;
  pfx: Buffer;
  senha: string;
  ultNsu?: string;
  producao?: boolean;
  timeout?: number;
}): Promise<RespostaDistribuicao> {
  const cuf = UF_CODIGO[(params.uf || '').toUpperCase()];
  if (!cuf) throw new SefazError(`UF inválida: ${params.uf}`);
  const producao = params.producao ?? true;
  const ambiente = producao ? 1 : 2;
  const url = producao ? URL_PRODUCAO : URL_HOMOLOGACAO;
  const envelope = montarEnvelope(params.cnpj.replace(/\D/g, ''), cuf, ambiente, params.ultNsu ?? '0');

  const corpo = await postMtls(url, envelope, params.pfx, params.senha, params.timeout ?? 60000);
  return parseResposta(corpo);
}

function postMtls(url: string, body: string, pfx: Buffer, senha: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: 443,
        path: u.pathname,
        pfx,
        passphrase: senha,
        // certificado do servidor SEFAZ é ICP-Brasil (fora do trust store padrão);
        // a autenticação é garantida pelo mTLS do cliente.
        rejectUnauthorized: false,
        timeout,
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if ((res.statusCode ?? 0) >= 400) {
            reject(new SefazError(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            resolve(data);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new SefazError('timeout SEFAZ')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
