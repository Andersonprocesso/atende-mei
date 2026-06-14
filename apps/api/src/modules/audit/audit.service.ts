import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditEntry {
  tenantId: string;
  usuarioId?: string | null;
  acao: string;
  entidade?: string;
  entidadeId?: string;
  dados?: Prisma.InputJsonValue;
  ip?: string;
}

// Trilha de auditoria (LGPD). Nunca registrar dados sensíveis em `dados`.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          usuarioId: entry.usuarioId ?? null,
          acao: entry.acao,
          entidade: entry.entidade,
          entidadeId: entry.entidadeId,
          dados: entry.dados,
          ip: entry.ip,
        },
      });
    } catch (e) {
      // Auditoria não deve derrubar a operação principal.
      this.logger.error(`Falha ao gravar auditoria (${entry.acao})`, e as Error);
    }
  }
}
