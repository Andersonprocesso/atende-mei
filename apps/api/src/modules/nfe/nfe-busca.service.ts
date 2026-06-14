import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto.service';
import { AuditService } from '../audit/audit.service';
import {
  consultarDistribuicao,
  fimDaFila,
  SefazError,
} from './sefaz-distribuicao.client';

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, attributeNamePrefix: '@_' });

interface CamposNota {
  chave?: string;
  situacao: 'resumo' | 'completa';
  emitenteCnpj?: string;
  emitenteNome?: string;
  valorTotal?: number;
  dataEmissao?: Date;
  modelo?: string;
}

@Injectable()
export class NfeBuscaService {
  private readonly logger = new Logger('NFeBusca');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cripto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async listar(tenantId: string, clienteId: string) {
    return this.prisma.nfeEntrada.findMany({
      where: { tenantId, clienteId },
      orderBy: { dataEmissao: 'desc' },
      take: 200,
    });
  }

  // Sincroniza as NF-e de entrada do MEI a partir do último NSU conhecido.
  async buscar(tenantId: string, usuarioId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    if (!cliente.cnpj) throw new BadRequestException('MEI sem CNPJ');
    if (!cliente.certificadoPfxEnc || !cliente.certificadoSenhaEnc) {
      throw new BadRequestException('MEI sem certificado A1 cadastrado (necessário para a SEFAZ).');
    }

    const pfx = this.cripto.decrypt(cliente.certificadoPfxEnc);
    const senha = this.cripto.decryptToString(cliente.certificadoSenhaEnc);
    const uf = cliente.uf ?? 'SP';

    let ultNsu = cliente.nfeUltimoNsu ?? '0';
    let baixadas = 0;
    let cstatFinal = '';
    let motivoFinal = '';

    for (let i = 0; i < 15; i++) {
      let resp;
      try {
        resp = await consultarDistribuicao({ cnpj: cliente.cnpj, uf, pfx, senha, ultNsu });
      } catch (e) {
        if (e instanceof SefazError) throw new BadRequestException(`SEFAZ: ${e.message}`);
        throw e;
      }
      cstatFinal = resp.cstat;
      motivoFinal = resp.motivo;

      // 138 = documentos localizados; 137 = nada novo; 656 = consumo indevido
      if (resp.cstat === '656') {
        motivoFinal = 'Consumo indevido — aguarde alguns minutos antes de buscar de novo.';
        break;
      }
      for (const doc of resp.documentos) {
        const campos = this.extrair(doc.xml, doc.schema);
        if (!campos?.chave) continue;
        await this.upsertNota(tenantId, clienteId, doc.nsu, campos);
        baixadas++;
      }
      ultNsu = resp.ultimoNsu;
      if (resp.cstat !== '138' || fimDaFila(resp)) break;
    }

    await this.prisma.cliente.update({
      where: { id: clienteId },
      data: { nfeUltimoNsu: ultNsu },
    });
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'nfe.buscar',
      entidade: 'Cliente',
      entidadeId: clienteId,
      dados: { baixadas, ultNsu, cstat: cstatFinal },
    });

    return { baixadas, ultimoNsu: ultNsu, cstat: cstatFinal, motivo: motivoFinal };
  }

  private async upsertNota(tenantId: string, clienteId: string, nsu: string, c: CamposNota) {
    await this.prisma.nfeEntrada.upsert({
      where: { clienteId_chave: { clienteId, chave: c.chave! } },
      create: {
        tenantId,
        clienteId,
        chave: c.chave!,
        nsu,
        modelo: c.modelo,
        situacao: c.situacao,
        emitenteCnpj: c.emitenteCnpj,
        emitenteNome: c.emitenteNome,
        valorTotal: c.valorTotal,
        dataEmissao: c.dataEmissao,
      },
      update: {
        // nota completa não é sobrescrita por um resumo posterior
        ...(c.situacao === 'completa'
          ? {
              situacao: c.situacao,
              modelo: c.modelo,
              emitenteCnpj: c.emitenteCnpj,
              emitenteNome: c.emitenteNome,
              valorTotal: c.valorTotal,
              dataEmissao: c.dataEmissao,
            }
          : {}),
      },
    });
  }

  // Normaliza resNFe (resumo) e procNFe/nfeProc (nota completa).
  private extrair(xml: string, schema: string): CamposNota | null {
    const s = (schema || '').toLowerCase();
    let obj: any;
    try {
      obj = parser.parse(xml);
    } catch {
      return null;
    }

    const resNFe = this.achar(obj, 'resNFe');
    if (s.startsWith('resnfe') || resNFe) {
      const r = resNFe ?? obj;
      return {
        chave: this.achar(r, 'chNFe'),
        situacao: 'resumo',
        emitenteCnpj: this.achar(r, 'CNPJ'),
        emitenteNome: this.achar(r, 'xNome'),
        valorTotal: this.num(this.achar(r, 'vNF')),
        dataEmissao: this.data(this.achar(r, 'dhEmi')),
        modelo: '55',
      };
    }

    const inf = this.achar(obj, 'infNFe');
    if (s.startsWith('procnfe') || s.startsWith('nfeproc') || inf) {
      const emit = this.achar(obj, 'emit');
      const ide = this.achar(obj, 'ide');
      const total = this.achar(obj, 'ICMSTot');
      let chave: string | undefined;
      const id = inf?.['@_Id'];
      if (id) chave = String(id).replace('NFe', '').trim();
      return {
        chave: chave ?? this.achar(obj, 'chNFe'),
        situacao: 'completa',
        emitenteCnpj: emit ? this.achar(emit, 'CNPJ') : undefined,
        emitenteNome: emit ? this.achar(emit, 'xNome') : undefined,
        valorTotal: this.num(total ? this.achar(total, 'vNF') : undefined),
        dataEmissao: this.data(ide ? this.achar(ide, 'dhEmi') : undefined),
        modelo: ide ? this.achar(ide, 'mod') : '55',
      };
    }
    return null; // evento/outro schema
  }

  private achar(obj: any, nome: string): any {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (nome in obj) return obj[nome];
    for (const v of Object.values(obj)) {
      const r = this.achar(v, nome);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  private num(v: any): number | undefined {
    if (v == null) return undefined;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  private data(v: any): Date | undefined {
    if (!v) return undefined;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? undefined : d;
  }
}
