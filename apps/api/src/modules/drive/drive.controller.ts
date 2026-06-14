import { Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DriveService } from './drive.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/auth-user';

@Controller('drive')
export class DriveController {
  constructor(private readonly drive: DriveService) {}

  @Roles(UserRole.ADMIN)
  @Get('status')
  status() {
    return this.drive.status();
  }

  // Cria/reusa a pasta do MEI no Drive (raiz AtendeMEI).
  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Post('cliente/:clienteId/pasta')
  criarPasta(@CurrentUser() user: AuthUser, @Param('clienteId') clienteId: string) {
    return this.drive.criarPastaMei(user.tenantId, user.sub, clienteId);
  }
}
