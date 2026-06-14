import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FaturamentoService } from './faturamento.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/auth-user';

@Controller('faturamento')
export class FaturamentoController {
  constructor(private readonly faturamento: FaturamentoService) {}

  // Resumo do limite anual de um MEI (gauge).
  @Get('cliente/:clienteId')
  async resumo(
    @CurrentUser() user: AuthUser,
    @Param('clienteId') clienteId: string,
    @Query('ano') ano?: string,
  ) {
    const anoNum = ano ? Number(ano) : undefined;
    const [resumo, lancamentos] = await Promise.all([
      this.faturamento.resumo(user.tenantId, clienteId, anoNum),
      this.faturamento.listar(user.tenantId, clienteId, anoNum),
    ]);
    return { resumo, lancamentos };
  }

  // Lança uma receita no faturamento do MEI.
  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Post('cliente/:clienteId')
  lancar(
    @CurrentUser() user: AuthUser,
    @Param('clienteId') clienteId: string,
    @Body() body: { competencia: string; valor: number; descricao?: string },
  ) {
    return this.faturamento.adicionar(user.tenantId, user.sub, clienteId, body);
  }

  // Carteira: MEIs próximos/acima do limite.
  @Get('alertas')
  alertas(@CurrentUser() user: AuthUser) {
    return this.faturamento.alertasCarteira(user.tenantId);
  }
}
