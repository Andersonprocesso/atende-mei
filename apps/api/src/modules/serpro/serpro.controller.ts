import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Put,
} from '@nestjs/common';
import { GuiaDASStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { SerproAuthService } from './serpro-auth.service';
import { PgmeiService } from './pgmei.service';
import { CredenciaisSerproService } from './credenciais-serpro.service';
import { AuditService } from '../audit/audit.service';

@Roles(UserRole.ADMIN, UserRole.CONTADOR)
@Controller('serpro')
export class SerproController {
  constructor(
    private readonly auth: SerproAuthService,
    private readonly pgmei: PgmeiService,
    private readonly credenciais: CredenciaisSerproService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────── credenciais (subidas pelo painel, nunca expostas) ─────────

  @Roles(UserRole.ADMIN)
  @Get('credenciais')
  statusCredenciais(@CurrentUser() user: AuthUser) {
    return this.credenciais.status(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Put('credenciais')
  async salvarCredenciais(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      consumerKey?: string;
      consumerSecret?: string;
      pfxBase64?: string;
      senhaPfx?: string;
      contratanteCnpj?: string;
      autorCnpj?: string;
    },
  ) {
    const res = await this.credenciais.salvar(user.tenantId, body);
    await this.audit.log({
      tenantId: user.tenantId,
      usuarioId: user.sub,
      acao: 'serpro.credenciais.salvar',
      entidade: 'CredencialSerpro',
    });
    return res;
  }

  // ───────── diagnóstico ─────────

  @Roles(UserRole.ADMIN)
  @Get('status')
  async status(@CurrentUser() user: AuthUser) {
    if (!(await this.auth.configurado(user.tenantId))) {
      return { configurado: false, conectado: false };
    }
    try {
      const t = await this.auth.obterTokens(user.tenantId);
      return { configurado: true, conectado: true, temJwt: !!t.jwt_token };
    } catch (e) {
      return {
        configurado: true,
        conectado: false,
        erro: e instanceof Error ? e.message : 'falha',
      };
    }
  }

  // ───────── DAS ─────────

  @Post('das')
  async gerarDas(
    @CurrentUser() user: AuthUser,
    @Body() body: { clienteId?: string; competencia?: string },
  ) {
    if (!(await this.pgmei.configurado(user.tenantId))) {
      throw new BadRequestException('SERPRO não configurado. Cadastre as credenciais.');
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

    const das = await this.pgmei.gerarDas(user.tenantId, cliente.cnpj, competencia);

    const vencParsed = das.vencimento ? new Date(das.vencimento) : null;
    const venc = vencParsed && !isNaN(vencParsed.getTime()) ? vencParsed : new Date();
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
      pdfBase64: das.pdfBase64,
    };
  }
}

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
