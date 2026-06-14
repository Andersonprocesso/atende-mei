import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConversaStatus } from '@prisma/client';
import { InboxService } from './inbox.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/auth-user';

// Inbox do painel (protegida pelo JWT global). Escopada por tenant.
@Controller('conversas')
export class ConversasController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser, @Query('status') status?: ConversaStatus) {
    return this.inbox.listarConversas(user.tenantId, status);
  }

  @Get(':id/mensagens')
  mensagens(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inbox.mensagens(user.tenantId, id);
  }

  @Post(':id/assumir')
  assumir(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inbox.assumir(user.tenantId, id, user.sub);
  }

  @Post(':id/devolver')
  devolver(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inbox.devolver(user.tenantId, id);
  }

  @Post(':id/responder')
  responder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('texto') texto: string,
  ) {
    return this.inbox.responder(user.tenantId, id, user.sub, texto);
  }
}
