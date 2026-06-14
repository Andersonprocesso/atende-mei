import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { GuiaDASStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { SerproAuthService } from './serpro-auth.service';
import { PgmeiService } from './pgmei.service';
import { AuditService } from '../audit/audit.service';

@Roles(UserRole.ADMIN, UserRole.CONTADOR)
@Controller('serpro')
export class SerproController {
  constructor(
    private readonly auth: SerproAuthService,
    private readonly pgmei: PgmeiService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Diagnóstico: credenciais presentes e autenticação funcionando.
  @Roles(UserRole.ADMIN)
  @Get('status')
  async status() {
    if (!this.auth.configurado) return { configurado: false, conectado: false };
    try {
      const t = await this.auth.obterTokens();
      return { configurado: true, conectado: true, temJwt: !!t.jwt_token };
    } catch (e) {
      return {
        configurado: true,
        conectado: false,
        erro: e instanceof Error ? e.message : 'falha',
      };
    }
  }

  // Gera a DAS de um MEI da carteira para uma competência (AAAA-MM).
  @Post('das')
  async gerarDas(
    @CurrentUser() user: AuthUser,
    @Body() body: { clienteId?: string; competencia?: string },
  ) {
    if (!this.pgmei.configurado) {
      throw new BadRequestException('SERPRO não configurado nesta instância.');
    }
    if (!body.clienteId) throw new BadRequestException('clienteId obrigatório');
    const competencia = body.competencia ?? competenciaAtual();
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      throw new BadRequestException('competencia deve ser AAAA-MM');
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: body.clienteId, tenantId: user.tenantId },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    if (!cliente.cnpj) throw new BadRequestException('Cliente sem CNPJ');

    const das = await this.pgmei.gerarDas(cliente.cnpj, competencia);

    // persiste/atualiza a guia
    const venc = das.vencimento ? new Date(das.vencimento) : new Date();
    const guia = await this.prisma.guiaDAS.upsert({
      where: { clienteId_competencia: { clienteId: cliente.id, competencia } },
      create: {
        tenantId: user.tenantId,
        clienteId: cliente.id,
        competencia,
        valor: das.valorTotal ?? 0,
        vencimento: venc,
        linhaDigitavel: das.linhaDigitavel,
        status: GuiaDASStatus.GERADA,
      },
      update: {
        valor: das.valorTotal ?? 0,
        vencimento: venc,
        linhaDigitavel: das.linhaDigitavel,
        status: GuiaDASStatus.GERADA,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      usuarioId: user.sub,
      acao: 'das.gerar',
      entidade: 'GuiaDAS',
      entidadeId: guia.id,
      dados: { competencia, valor: das.valorTotal },
    });

    return {
      guiaId: guia.id,
      competencia,
      valorTotal: das.valorTotal,
      vencimento: das.vencimento,
      linhaDigitavel: das.linhaDigitavel,
      pdfBase64: das.pdfBase64, // para o painel/WhatsApp anexar o PDF
    };
  }
}

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
