import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

// IMPORTANTE: todo método recebe tenantId e SEMPRE escopa a query por ele.
// É aqui que mora o isolamento multi-tenant.
@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cripto: CryptoService,
  ) {}

  async list(tenantId: string, query: QueryClientesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ClienteWhereInput = { tenantId };

    if (query.situacaoFiscal) where.situacaoFiscal = query.situacaoFiscal;
    if (query.ativo === 'true') where.ativo = true;
    if (query.ativo === 'false') where.ativo = false;

    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { razaoSocial: { contains: q, mode: 'insensitive' } },
        { nomeFantasia: { contains: q, mode: 'insensitive' } },
        { nomeContato: { contains: q, mode: 'insensitive' } },
        { cnpj: { contains: q } },
        { telefoneWa: { contains: q } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.cliente.count({ where }),
      this.prisma.cliente.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Ficha do cliente: dados + agregados/relacionados (etapas seguintes preenchem).
  async findOne(tenantId: string, id: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, tenantId },
      include: {
        assinaturas: {
          include: { plano: true },
          orderBy: { criadoEm: 'desc' },
          take: 1,
        },
        _count: {
          select: { notas: true, guias: true, conversas: true },
        },
      },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    // nunca expor o conteúdo cifrado do certificado/senha
    const { certificadoPfxEnc, certificadoSenhaEnc, ...resto } = cliente;
    return { ...resto, temCertificado: !!certificadoPfxEnc };
  }

  async create(tenantId: string, usuarioId: string, dto: CreateClienteDto) {
    const existe = await this.prisma.cliente.findFirst({
      where: { tenantId, OR: [{ cnpj: dto.cnpj }, { telefoneWa: dto.telefoneWa }] },
    });
    if (existe) {
      throw new ConflictException('CNPJ ou telefone já cadastrado neste tenant');
    }

    const cliente = await this.prisma.cliente.create({
      data: { tenantId, ...dto },
    });

    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'cliente.criar',
      entidade: 'Cliente',
      entidadeId: cliente.id,
    });
    return cliente;
  }

  async update(
    tenantId: string,
    usuarioId: string,
    id: string,
    dto: UpdateClienteDto,
  ) {
    await this.ensureExists(tenantId, id);
    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'cliente.atualizar',
      entidade: 'Cliente',
      entidadeId: id,
    });
    return cliente;
  }

  // Soft delete: desativa em vez de apagar (preserva histórico fiscal).
  async deactivate(tenantId: string, usuarioId: string, id: string) {
    await this.ensureExists(tenantId, id);
    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: { ativo: false },
    });
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'cliente.desativar',
      entidade: 'Cliente',
      entidadeId: id,
    });
    return cliente;
  }

  // Importa/atualiza uma lista de MEIs (ex.: casados na Omie). Idempotente por CNPJ.
  async importar(
    tenantId: string,
    usuarioId: string,
    itens: {
      cnpj: string;
      razaoSocial?: string;
      nomeFantasia?: string;
      cpfProprietario?: string;
      omieCodigoCliente?: string;
    }[],
  ) {
    let criados = 0;
    let atualizados = 0;
    for (const it of itens) {
      const dados = {
        razaoSocial: it.razaoSocial,
        nomeFantasia: it.nomeFantasia,
        cpfProprietario: it.cpfProprietario,
        omieCodigoCliente: it.omieCodigoCliente,
      };
      const existente = await this.prisma.cliente.findUnique({
        where: { tenantId_cnpj: { tenantId, cnpj: it.cnpj } },
        select: { id: true },
      });
      if (existente) {
        await this.prisma.cliente.update({ where: { id: existente.id }, data: dados });
        atualizados++;
      } else {
        await this.prisma.cliente.create({
          data: { tenantId, cnpj: it.cnpj, ...dados },
        });
        criados++;
      }
    }
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'cliente.importar',
      entidade: 'Cliente',
      dados: { total: itens.length, criados, atualizados },
    });
    return { total: itens.length, criados, atualizados };
  }

  // Sobe/atualiza o certificado A1 do MEI (cifrado em repouso).
  async salvarCertificado(
    tenantId: string,
    usuarioId: string,
    id: string,
    input: { pfxBase64: string; senha: string; nome?: string; validade?: string },
  ) {
    await this.ensureExists(tenantId, id);
    const pfx = Buffer.from(input.pfxBase64, 'base64');
    const fingerprint = crypto.createHash('sha256').update(pfx).digest('hex');

    // Extrai validade e titular direto do PFX (não depende de digitação).
    const meta = this.lerCertificado(pfx, input.senha);
    const validade = meta?.validade ?? (input.validade ? new Date(input.validade) : undefined);

    await this.prisma.cliente.update({
      where: { id },
      data: {
        certificadoPfxEnc: this.cripto.encrypt(pfx),
        certificadoSenhaEnc: this.cripto.encrypt(input.senha),
        certificadoFingerprint: fingerprint,
        certificadoNome: input.nome ?? meta?.titular,
        certificadoValidade: validade,
      },
    });
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'cliente.certificado.salvar',
      entidade: 'Cliente',
      entidadeId: id,
    });
    return { ok: true, fingerprint };
  }

  // Exclusão definitiva (cascata em conversas/notas/guias). Use com cuidado.
  async remover(tenantId: string, usuarioId: string, id: string) {
    await this.ensureExists(tenantId, id);
    await this.prisma.cliente.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'cliente.remover',
      entidade: 'Cliente',
      entidadeId: id,
    });
    return { ok: true };
  }

  // Lê validade (notAfter) e titular (CN) de um .pfx. Retorna null se a senha
  // estiver incorreta ou o arquivo não puder ser lido.
  private lerCertificado(
    pfx: Buffer,
    senha: string,
  ): { validade: Date; titular?: string } | null {
    try {
      const p12Der = forge.util.createBuffer(pfx.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);
      for (const safeContents of p12.safeContents) {
        for (const bag of safeContents.safeBags) {
          if (bag.type === forge.pki.oids.certBag && bag.cert) {
            const cert = bag.cert;
            const cn = cert.subject.getField('CN');
            return {
              validade: cert.validity.notAfter,
              titular: cn?.value,
            };
          }
        }
      }
    } catch {
      /* senha errada ou arquivo inválido */
    }
    return null;
  }

  // Certificados vencendo dentro de N dias (ou já vencidos).
  async certificadosVencendo(tenantId: string, dias = 30) {
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);
    const clientes = await this.prisma.cliente.findMany({
      where: {
        tenantId,
        certificadoValidade: { not: null, lte: limite },
      },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        certificadoNome: true,
        certificadoValidade: true,
      },
      orderBy: { certificadoValidade: 'asc' },
    });
    const hoje = new Date();
    return clientes.map((c) => ({
      ...c,
      diasRestantes: c.certificadoValidade
        ? Math.ceil((c.certificadoValidade.getTime() - hoje.getTime()) / 86400000)
        : null,
    }));
  }

  private async ensureExists(tenantId: string, id: string) {
    const c = await this.prisma.cliente.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Cliente não encontrado');
  }
}
