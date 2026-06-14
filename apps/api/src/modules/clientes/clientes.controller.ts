import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';
import { ImportarClientesDto } from './dto/importar-clientes.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/auth-user';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryClientesDto) {
    return this.clientes.list(user.tenantId, query);
  }

  // Certificados vencendo (default 30 dias).
  @Get('certificados/vencendo')
  certificadosVencendo(
    @CurrentUser() user: AuthUser,
    @Query('dias') dias?: string,
  ) {
    return this.clientes.certificadosVencendo(user.tenantId, dias ? Number(dias) : 30);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clientes.findOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClienteDto) {
    return this.clientes.create(user.tenantId, user.sub, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Post('importar')
  importar(@CurrentUser() user: AuthUser, @Body() dto: ImportarClientesDto) {
    return this.clientes.importar(user.tenantId, user.sub, dto.clientes);
  }

  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.clientes.update(user.tenantId, user.sub, id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Delete(':id')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clientes.deactivate(user.tenantId, user.sub, id);
  }

  // Exclusão definitiva (somente ADMIN).
  @Roles(UserRole.ADMIN)
  @Delete(':id/remover')
  remover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clientes.remover(user.tenantId, user.sub, id);
  }

  // Upload do certificado A1 individual do MEI.
  @Roles(UserRole.ADMIN, UserRole.CONTADOR)
  @Post(':id/certificado')
  salvarCertificado(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: { pfxBase64: string; senha: string; nome?: string; validade?: string },
  ) {
    return this.clientes.salvarCertificado(user.tenantId, user.sub, id, body);
  }
}
