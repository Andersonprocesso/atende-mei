import { Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaileysWhatsappProvider } from './providers/baileys-whatsapp.provider';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/auth-user';

// Painel: status da conexão WhatsApp (QR/conectado) e controle.
@Controller('whatsapp-conexao')
export class WhatsappConexaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly baileys: BaileysWhatsappProvider,
  ) {}

  @Get()
  async status(@CurrentUser() user: AuthUser) {
    const c = await this.prisma.whatsappConexao.findUnique({
      where: { tenantId: user.tenantId },
    });
    return {
      status: c?.status ?? 'DESCONECTADO',
      numero: c?.numero ?? null,
      qrcode: c?.status === 'QRCODE' ? c?.qrcode ?? null : null,
      atualizadoEm: c?.atualizadoEm ?? null,
    };
  }

  // Reinicia a conexão (gera novo QR se preciso).
  @Roles(UserRole.ADMIN)
  @Post('reconectar')
  async reconectar(@CurrentUser() user: AuthUser) {
    await this.baileys.iniciar(user.tenantId);
    return { ok: true };
  }

  // Desconecta e limpa a sessão (exige novo QR).
  @Roles(UserRole.ADMIN)
  @Post('desconectar')
  async desconectar() {
    await this.baileys.desconectar();
    return { ok: true };
  }
}
