import { Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { NfeBuscaService } from './nfe-busca.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/auth-user';

@Controller('nfe')
export class NfeController {
  constructor(private readonly nfe: NfeBuscaService) {}

  // NF-e de entrada já baixadas do MEI.
  @Get('cliente/:clienteId')
  listar(@CurrentUser() user: AuthUser, @Param('clienteId') clienteId: string) {
    return this.nfe.listar(user.tenantId, clienteId);
  }

  // Sincroniza com a SEFAZ (NFeDistribuicaoDFe) a partir do último NSU.
  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Post('cliente/:clienteId/buscar')
  buscar(@CurrentUser() user: AuthUser, @Param('clienteId') clienteId: string) {
    return this.nfe.buscar(user.tenantId, user.sub, clienteId);
  }
}
