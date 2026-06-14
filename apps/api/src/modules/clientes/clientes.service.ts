import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
    return cliente;
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

  private async ensureExists(tenantId: string, id: string) {
    const c = await this.prisma.cliente.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Cliente não encontrado');
  }
}
