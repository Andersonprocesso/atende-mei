import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.usuario.findMany({
      where: { tenantId },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async create(tenantId: string, autorId: string, dto: CreateUsuarioDto) {
    const existe = await this.prisma.usuario.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existe) throw new ConflictException('Email já usado neste tenant');

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const usuario = await this.prisma.usuario.create({
      data: {
        tenantId,
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        role: dto.role,
      },
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
    await this.audit.log({
      tenantId,
      usuarioId: autorId,
      acao: 'usuario.criar',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      dados: { role: dto.role },
    });
    return usuario;
  }
}
